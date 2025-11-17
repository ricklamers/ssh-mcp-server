import { Client, ConnectConfig } from "ssh2";
import { readFile } from "fs/promises";
import { SSHServerConfig, CommandResult, SSHError } from "./types.js";

/**
 * Manages persistent SSH connections to multiple servers
 */
export class SSHConnectionManager {
  private connections: Map<string, Client> = new Map();
  private configs: Map<string, SSHServerConfig> = new Map();
  private connectionPromises: Map<string, Promise<Client>> = new Map();

  constructor(private serverConfigs: SSHServerConfig[]) {
    if (serverConfigs.length === 0) {
      throw new Error("At least one SSH server configuration is required");
    }

    // Validate unique slugs
    const slugs = new Set<string>();
    for (const config of serverConfigs) {
      if (slugs.has(config.slug)) {
        throw new Error(`Duplicate server slug: ${config.slug}`);
      }
      slugs.add(config.slug);
      this.configs.set(config.slug, config);
    }
  }

  /**
   * Get the default server slug (first configured server)
   */
  getDefaultSlug(): string {
    return this.serverConfigs[0].slug;
  }

  /**
   * Get all configured server slugs
   */
  getAllSlugs(): string[] {
    return this.serverConfigs.map((config) => config.slug);
  }

  /**
   * Get or create a connection to the specified server
   */
  private async getConnection(slug: string): Promise<Client> {
    // Check if we already have an active connection
    const existingConnection = this.connections.get(slug);
    if (existingConnection && this.isConnectionAlive(existingConnection)) {
      return existingConnection;
    }

    // Check if we're already connecting
    const existingPromise = this.connectionPromises.get(slug);
    if (existingPromise) {
      return existingPromise;
    }

    // Create new connection
    const connectionPromise = this.createConnection(slug);
    this.connectionPromises.set(slug, connectionPromise);

    try {
      const client = await connectionPromise;
      this.connections.set(slug, client);
      return client;
    } finally {
      this.connectionPromises.delete(slug);
    }
  }

  /**
   * Check if a connection is still alive
   */
  private isConnectionAlive(client: Client): boolean {
    // ssh2 doesn't have a direct isAlive method, but we can check if it's writable
    // A proper check would involve the connection state, but we'll rely on error handling
    return true; // We'll let errors during execution trigger reconnection
  }

  /**
   * Create a new SSH connection
   */
  private async createConnection(slug: string): Promise<Client> {
    const config = this.configs.get(slug);
    if (!config) {
      throw new SSHError(`Unknown server slug: ${slug}`, slug);
    }

    const client = new Client();

    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: config.timeout || 10000,
      // Disable interactive authentication
      tryKeyboard: false,
    };

    // Add authentication method
    if (config.privateKeyPath) {
      try {
        const privateKey = await readFile(config.privateKeyPath, "utf8");
        connectConfig.privateKey = privateKey;
        if (config.passphrase) {
          connectConfig.passphrase = config.passphrase;
        }
      } catch (error) {
        throw new SSHError(
          `Failed to read private key from ${config.privateKeyPath}`,
          slug,
          error instanceof Error ? error : undefined
        );
      }
    } else if (config.privateKey) {
      try {
        // Decode base64-encoded private key
        const privateKey = Buffer.from(config.privateKey, "base64").toString("utf8");
        connectConfig.privateKey = privateKey;
        if (config.passphrase) {
          connectConfig.passphrase = config.passphrase;
        }
      } catch (error) {
        throw new SSHError(
          `Failed to decode base64 private key for ${slug}`,
          slug,
          error instanceof Error ? error : undefined
        );
      }
    } else if (config.password) {
      connectConfig.password = config.password;
    } else {
      throw new SSHError(
        `No authentication method configured for ${slug}. Provide either password, privateKeyPath, or privateKey.`,
        slug
      );
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.end();
        reject(
          new SSHError(
            `Connection timeout after ${config.timeout || 10000}ms`,
            slug
          )
        );
      }, config.timeout || 10000);

      client.on("ready", () => {
        clearTimeout(timeout);
        resolve(client);
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        reject(new SSHError(`Connection failed: ${err.message}`, slug, err));
      });

      client.on("close", () => {
        // Remove from connections map when connection closes
        this.connections.delete(slug);
      });

      client.connect(connectConfig);
    });
  }

  /**
   * Execute a command on the specified server
   */
  async executeCommand(
    command: string,
    slug?: string
  ): Promise<CommandResult> {
    const targetSlug = slug || this.getDefaultSlug();
    const config = this.configs.get(targetSlug);

    if (!config) {
      throw new SSHError(`Unknown server slug: ${targetSlug}`, targetSlug);
    }

    let client: Client;
    try {
      client = await this.getConnection(targetSlug);
    } catch (error) {
      throw new SSHError(
        `Failed to connect to ${targetSlug}: ${error instanceof Error ? error.message : String(error)}`,
        targetSlug,
        error instanceof Error ? error : undefined
      );
    }

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let exitCode = 0;

      client.exec(command, { pty: false }, (err, stream) => {
        if (err) {
          // Connection might be dead, remove it
          this.connections.delete(targetSlug);
          reject(
            new SSHError(
              `Failed to execute command: ${err.message}`,
              targetSlug,
              err
            )
          );
          return;
        }

        stream.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on("close", (code: number) => {
          exitCode = code || 0;
          resolve({
            stdout,
            stderr,
            exitCode,
            serverSlug: targetSlug,
          });
        });

        stream.on("error", (streamErr: Error) => {
          reject(
            new SSHError(
              `Stream error: ${streamErr.message}`,
              targetSlug,
              streamErr
            )
          );
        });
      });
    });
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    const clients = Array.from(this.connections.values());
    this.connections.clear();
    this.connectionPromises.clear();

    for (const client of clients) {
      client.end();
    }
  }

  /**
   * Close connection to a specific server
   */
  async closeConnection(slug: string): Promise<void> {
    const client = this.connections.get(slug);
    if (client) {
      client.end();
      this.connections.delete(slug);
    }
  }
}


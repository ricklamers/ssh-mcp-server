#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { SSHConnectionManager } from "./ssh-manager.js";
import { SSHServerConfig, SSHError } from "./types.js";
import { z } from "zod";

// Configuration schema for validation
const SSHConfigSchema = z.object({
  slug: z.string().min(1).describe("Unique identifier for this SSH server"),
  host: z.string().min(1).describe("Hostname or IP address"),
  port: z.number().int().positive().optional().default(22),
  username: z.string().min(1).describe("SSH username"),
  password: z.string().optional(),
  privateKeyPath: z.string().optional(),
  privateKey: z.string().optional().describe("Base64-encoded private key"),
  passphrase: z.string().optional(),
  timeout: z.number().int().positive().optional().default(10000),
});

const SSHServersConfigSchema = z.object({
  servers: z.array(SSHConfigSchema).min(1),
});

/**
 * Load SSH configuration from environment variable
 */
function loadConfig(): SSHServerConfig[] {
  const configStr = process.env.SSH_MCP_CONFIG;
  if (!configStr) {
    throw new Error(
      "SSH_MCP_CONFIG environment variable is required. " +
        "It should contain a JSON object with a 'servers' array."
    );
  }

  try {
    const parsed = JSON.parse(configStr);
    const validated = SSHServersConfigSchema.parse(parsed);
    return validated.servers;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`Invalid SSH configuration:\n${issues}`);
    }
    throw new Error(
      `Failed to parse SSH configuration: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Main server implementation
 */
class SSHMCPServer {
  private server: Server;
  private sshManager: SSHConnectionManager;

  constructor(config: SSHServerConfig[]) {
    this.sshManager = new SSHConnectionManager(config);

    this.server = new Server(
      {
        name: "ssh-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const slugs = this.sshManager.getAllSlugs();
      const defaultSlug = this.sshManager.getDefaultSlug();

      const tools: Tool[] = [
        {
          name: "execute_ssh_command",
          description: `Execute a bash command on a remote SSH server. Available servers: ${slugs.join(", ")}. Default server: ${defaultSlug}`,
          inputSchema: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description: "The bash command to execute on the remote server",
              },
              server: {
                type: "string",
                description: `Server slug to execute the command on. Available: ${slugs.join(", ")}. Defaults to: ${defaultSlug}`,
                enum: slugs,
              },
            },
            required: ["command"],
          },
        },
        {
          name: "list_ssh_servers",
          description: "List all configured SSH servers with their slugs",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === "execute_ssh_command") {
          return await this.handleExecuteCommand(args);
        } else if (name === "list_ssh_servers") {
          return await this.handleListServers();
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof SSHError
            ? `SSH Error [${error.serverSlug || "unknown"}]: ${error.message}`
            : error instanceof Error
              ? error.message
              : String(error);

        return {
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleExecuteCommand(args: unknown) {
    const command = (args as { command?: string }).command;
    const server = (args as { server?: string }).server;

    if (!command || typeof command !== "string") {
      throw new Error("Command is required and must be a string");
    }

    const result = await this.sshManager.executeCommand(command, server);

    // Format the response
    let response = `Command executed on server: ${result.serverSlug}\n`;
    response += `Exit code: ${result.exitCode}\n\n`;

    if (result.stdout) {
      response += `=== STDOUT ===\n${result.stdout}\n`;
    }

    if (result.stderr) {
      response += `\n=== STDERR ===\n${result.stderr}\n`;
    }

    if (!result.stdout && !result.stderr) {
      response += "(No output)\n";
    }

    return {
      content: [
        {
          type: "text",
          text: response,
        },
      ],
    };
  }

  private async handleListServers() {
    const slugs = this.sshManager.getAllSlugs();
    const defaultSlug = this.sshManager.getDefaultSlug();

    const response = `Configured SSH Servers:\n\n` +
      slugs
        .map((slug) => `  - ${slug}${slug === defaultSlug ? " (default)" : ""}`)
        .join("\n");

    return {
      content: [
        {
          type: "text",
          text: response,
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Log to stderr (not stdout to avoid corrupting JSON-RPC)
    console.error("SSH MCP Server running on stdio");
    console.error(
      `Configured servers: ${this.sshManager.getAllSlugs().join(", ")}`
    );
    console.error(`Default server: ${this.sshManager.getDefaultSlug()}`);
  }

  async close(): Promise<void> {
    await this.sshManager.closeAll();
    await this.server.close();
  }
}

/**
 * Main entry point
 */
async function main() {
  let server: SSHMCPServer | null = null;

  try {
    const config = loadConfig();
    server = new SSHMCPServer(config);

    // Handle shutdown gracefully
    process.on("SIGINT", async () => {
      console.error("\nShutting down gracefully...");
      if (server) {
        await server.close();
      }
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.error("\nShutting down gracefully...");
      if (server) {
        await server.close();
      }
      process.exit(0);
    });

    await server.run();
  } catch (error) {
    console.error(
      "Fatal error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});


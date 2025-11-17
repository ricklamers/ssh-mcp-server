/**
 * Configuration for a single SSH server
 */
export interface SSHServerConfig {
  /** Unique identifier for this SSH server */
  slug: string;
  /** Hostname or IP address */
  host: string;
  /** SSH port (default: 22) */
  port?: number;
  /** Username for SSH authentication */
  username: string;
  /** Password for authentication (if using password auth) */
  password?: string;
  /** Path to private key file (if using key auth) */
  privateKeyPath?: string;
  /** Base64-encoded private key (alternative to privateKeyPath) */
  privateKey?: string;
  /** Passphrase for private key (if needed) */
  passphrase?: string;
  /** Connection timeout in milliseconds (default: 10000) */
  timeout?: number;
}

/**
 * Result of executing an SSH command
 */
export interface CommandResult {
  /** Standard output from the command */
  stdout: string;
  /** Standard error from the command */
  stderr: string;
  /** Exit code of the command */
  exitCode: number;
  /** The slug of the server where command was executed */
  serverSlug: string;
}

/**
 * Error when SSH operations fail
 */
export class SSHError extends Error {
  constructor(
    message: string,
    public readonly serverSlug?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "SSHError";
  }
}


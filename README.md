# SSH MCP Server

A Model Context Protocol (MCP) server that enables secure SSH command execution on remote servers with persistent connection management.

## Features

- 🔌 **Persistent Connections**: Establishes SSH connections once and reuses them for multiple commands
- 🖥️ **Multiple Servers**: Configure and manage connections to multiple SSH servers
- 🔐 **Flexible Authentication**: Supports password, private key file, or base64-encoded private key authentication
- 📤 **Comprehensive Output**: Captures both stdout and stderr with exit codes
- 🚫 **Non-Interactive**: Designed for non-interactive command execution
- ⚡ **Efficient**: Connection pooling reduces overhead for repeated commands

## Installation

```bash
npm install
npm run build
```

## Configuration

The server is configured via the `SSH_MCP_CONFIG` environment variable, which should contain a JSON object with a `servers` array.

### Configuration Schema

```json
{
  "servers": [
    {
      "slug": "production",
      "host": "prod.example.com",
      "port": 22,
      "username": "deploy",
      "privateKeyPath": "/path/to/key.pem",
      "passphrase": "optional-passphrase",
      "timeout": 10000
    }
  ]
}
```

### Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | string | Yes | Unique identifier for the server |
| `host` | string | Yes | Hostname or IP address |
| `port` | number | No | SSH port (default: 22) |
| `username` | string | Yes | SSH username |
| `password` | string | No* | Password for authentication |
| `privateKeyPath` | string | No* | Path to private key file |
| `privateKey` | string | No* | Base64-encoded private key |
| `passphrase` | string | No | Passphrase for encrypted private key |
| `timeout` | number | No | Connection timeout in ms (default: 10000) |

*One of `password`, `privateKeyPath`, or `privateKey` must be provided.

### Authentication Methods

#### 1. Password Authentication

```json
{
  "servers": [
    {
      "slug": "dev",
      "host": "dev.example.com",
      "username": "developer",
      "password": "your-password"
    }
  ]
}
```

#### 2. Private Key File

```json
{
  "servers": [
    {
      "slug": "prod",
      "host": "prod.example.com",
      "username": "deploy",
      "privateKeyPath": "/Users/username/.ssh/id_rsa"
    }
  ]
}
```

#### 3. Base64-Encoded Private Key

First, encode your private key:

```bash
base64 -i ~/.ssh/id_rsa | tr -d '\n'
```

Then use it in the configuration:

```json
{
  "servers": [
    {
      "slug": "prod",
      "host": "prod.example.com",
      "username": "deploy",
      "privateKey": "LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0K..."
    }
  ]
}
```

### Multiple Servers Example

```json
{
  "servers": [
    {
      "slug": "web-prod",
      "host": "web1.example.com",
      "username": "deploy",
      "privateKeyPath": "/path/to/prod-key.pem"
    },
    {
      "slug": "db-prod",
      "host": "db1.example.com",
      "username": "dbadmin",
      "password": "secure-password"
    },
    {
      "slug": "staging",
      "host": "staging.example.com",
      "username": "developer",
      "privateKey": "LS0tLS1CRUdJTi..."
    }
  ]
}
```

## Usage with Claude for Desktop

### 1. Create Configuration File

Create a configuration file (e.g., `ssh-config.json`):

```json
{
  "servers": [
    {
      "slug": "myserver",
      "host": "example.com",
      "username": "user",
      "privateKeyPath": "/Users/username/.ssh/id_rsa"
    }
  ]
}
```

### 2. Configure Claude for Desktop

Edit your Claude for Desktop configuration file:

**macOS/Linux:**
```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```powershell
code $env:AppData\Claude\claude_desktop_config.json
```

Add the SSH MCP server:

```json
{
  "mcpServers": {
    "ssh": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/ssh-mcp-server/build/index.js"],
      "env": {
        "SSH_MCP_CONFIG": "{\"servers\":[{\"slug\":\"myserver\",\"host\":\"example.com\",\"username\":\"user\",\"privateKeyPath\":\"/Users/username/.ssh/id_rsa\"}]}"
      }
    }
  }
}
```

**Note:** For complex configurations, you can read from a file:

**macOS/Linux:**
```json
{
  "mcpServers": {
    "ssh": {
      "command": "bash",
      "args": [
        "-c",
        "SSH_MCP_CONFIG=$(cat /path/to/ssh-config.json) node /ABSOLUTE/PATH/TO/ssh-mcp-server/build/index.js"
      ]
    }
  }
}
```

**Windows (PowerShell):**
```json
{
  "mcpServers": {
    "ssh": {
      "command": "powershell",
      "args": [
        "-Command",
        "$env:SSH_MCP_CONFIG = Get-Content -Raw C:\\path\\to\\ssh-config.json; node C:\\ABSOLUTE\\PATH\\TO\\ssh-mcp-server\\build\\index.js"
      ]
    }
  }
}
```

### 3. Restart Claude for Desktop

Fully quit and restart Claude for Desktop (use Cmd+Q on macOS or Quit from system tray on Windows).

## Available Tools

### `execute_ssh_command`

Execute a bash command on a remote SSH server.

**Parameters:**
- `command` (required): The bash command to execute
- `server` (optional): Server slug to use (defaults to first configured server)

**Example prompts in Claude:**
- "Run `df -h` on myserver"
- "Execute `ps aux | grep nginx` on the production server"
- "Check the system uptime"

### `list_ssh_servers`

List all configured SSH servers.

**Example prompt in Claude:**
- "List available SSH servers"

## Example Commands

Once configured in Claude for Desktop, you can use natural language:

- "Check the disk usage on web-prod"
- "Show me the running processes on db-prod"
- "What's the current date and time on the staging server?"
- "Run `cat /var/log/nginx/error.log | tail -20` on web-prod"
- "Execute `docker ps` to see running containers"

## Direct Usage (Testing)

You can test the server directly:

```bash
# Set the configuration
export SSH_MCP_CONFIG='{"servers":[{"slug":"test","host":"example.com","username":"user","privateKeyPath":"/path/to/key.pem"}]}'

# Run the server
node build/index.js
```

## Security Considerations

1. **Private Keys**: Store private keys securely and use appropriate file permissions
2. **Passwords**: Avoid storing passwords in plain text; prefer key-based authentication
3. **Base64 Keys**: While convenient, base64-encoded keys in config files are still plain text
4. **Environment Variables**: Be cautious about exposing SSH credentials in environment variables
5. **Command Injection**: The server executes commands as provided; ensure proper validation in your usage

## Troubleshooting

### Connection Issues

Check Claude's logs:

**macOS:**
```bash
tail -f ~/Library/Logs/Claude/mcp-server-ssh.log
```

**Windows:**
```powershell
Get-Content $env:APPDATA\Claude\Logs\mcp-server-ssh.log -Wait
```

### Common Problems

1. **"Connection timeout"**: Check host, port, and network connectivity
2. **"Authentication failed"**: Verify username, password/key, and permissions
3. **"No authentication method configured"**: Ensure you've provided password, privateKeyPath, or privateKey
4. **"Failed to decode base64 private key"**: Verify your base64 encoding is correct

### Debug Mode

The server logs to stderr. When running via Claude for Desktop, check the MCP logs:

```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch
```

## Architecture

- **Connection Pooling**: Maintains one connection per server, reused across multiple commands
- **Error Handling**: Comprehensive error reporting with server context
- **Non-Interactive**: Disables PTY and keyboard-interactive authentication
- **Stream Capture**: Properly captures both stdout and stderr streams

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.


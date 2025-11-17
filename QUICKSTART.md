# Quick Start Guide

Get your SSH MCP server running in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
npm run build
```

## Step 2: Prepare Your SSH Configuration

### Option A: Using Private Key File

```json
{
  "servers": [
    {
      "slug": "myserver",
      "host": "your-server.com",
      "username": "your-username",
      "privateKeyPath": "/Users/your-username/.ssh/id_rsa"
    }
  ]
}
```

### Option B: Using Base64-Encoded Key

First, encode your key:
```bash
base64 -i ~/.ssh/id_rsa | tr -d '\n'
```

Then use it:
```json
{
  "servers": [
    {
      "slug": "myserver",
      "host": "your-server.com",
      "username": "your-username",
      "privateKey": "PASTE_BASE64_KEY_HERE"
    }
  ]
}
```

### Option C: Using Password (Less Secure)

```json
{
  "servers": [
    {
      "slug": "myserver",
      "host": "your-server.com",
      "username": "your-username",
      "password": "your-password"
    }
  ]
}
```

Save this as `ssh-config.json` in a secure location.

## Step 3: Configure Claude for Desktop

### macOS:

Open config file:
```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Add this configuration:
```json
{
  "mcpServers": {
    "ssh": {
      "command": "bash",
      "args": [
        "-c",
        "SSH_MCP_CONFIG=$(cat /ABSOLUTE/PATH/TO/ssh-config.json) node /ABSOLUTE/PATH/TO/ssh-mcp-server/build/index.js"
      ]
    }
  }
}
```

### Windows:

Open config file:
```powershell
code $env:AppData\Claude\claude_desktop_config.json
```

Add this configuration:
```json
{
  "mcpServers": {
    "ssh": {
      "command": "powershell",
      "args": [
        "-Command",
        "$env:SSH_MCP_CONFIG = Get-Content -Raw C:\\ABSOLUTE\\PATH\\TO\\ssh-config.json; node C:\\ABSOLUTE\\PATH\\TO\\ssh-mcp-server\\build\\index.js"
      ]
    }
  }
}
```

**Important:** Replace `/ABSOLUTE/PATH/TO/` with your actual paths!

## Step 4: Restart Claude

Fully quit Claude for Desktop:
- **macOS:** Press Cmd+Q or select "Quit Claude" from menu
- **Windows:** Right-click system tray icon and select "Quit"

Then reopen Claude for Desktop.

## Step 5: Test It!

In Claude, try these commands:

- "List available SSH servers"
- "Run `whoami` on myserver"
- "Check disk usage with `df -h`"
- "Show me running processes"

## Troubleshooting

### Not showing up in Claude?

1. Check the logs:
   ```bash
   # macOS
   tail -f ~/Library/Logs/Claude/mcp*.log
   ```

2. Verify your config paths are absolute (not relative)

3. Make sure you fully quit and restarted Claude

### Authentication errors?

1. Test SSH connection manually:
   ```bash
   ssh -i /path/to/key username@host
   ```

2. Check file permissions on private key:
   ```bash
   chmod 600 ~/.ssh/id_rsa
   ```

3. Verify your configuration JSON is valid

## Next Steps

- Read the full [README.md](README.md) for advanced features
- Configure multiple servers
- Explore different authentication methods

## Need Help?

Check the [README.md](README.md) for detailed documentation and troubleshooting.


# MCP UI - Multi-Server Chatbot Interface

A sophisticated chatbot interface that connects to multiple Model Context Protocol (MCP) servers with intelligent routing and markdown rendering.

## Features

✨ **Multi-Server Support**
- Calculator MCP Server (local Python)
- GitHub MCP Server (Docker)
- Atlassian MCP Server (Docker)

🧠 **Intelligent Routing**
- **Auto Mode**: Automatically selects the best tool from all servers based on query analysis
- **Manual Mode**: Direct connection to a specific server of your choice

🎨 **Modern UI**
- Glassmorphism design with premium aesthetics
- Real-time server status monitoring
- Markdown rendering for rich responses
- Responsive and animated interface

🔧 **Generic Tool Handling**
- Dynamic parameter mapping based on tool schemas
- Intelligent tool selection with scoring system
- Support for complex multi-step operations (up to 15 steps)
- Read-only mode for all servers

## Prerequisites

- Node.js 20+
- Python 3
- Docker (for GitHub and Atlassian MCP servers)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Calculator MCP Server (Local Python)
CALCULATOR_SERVER_PATH=./mcp-servers/calculator-server.py

# GitHub MCP Server (Docker)
GITHUB_PERSONAL_ACCESS_TOKEN=your_github_token_here
GITHUB_HOST=https://github.com
GITHUB_REPOSITORY=owner/repo

# Atlassian MCP Server (Docker)
ATLASSIAN_URL=https://your-domain.atlassian.net
ATLASSIAN_API_TOKEN=your_atlassian_token_here
ATLASSIAN_EMAIL=your_email@example.com
```

### 3. Run the Application

Start both frontend and backend concurrently:

```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Architecture

### Frontend
- React with TypeScript
- Vite for fast development
- React Markdown for rich text rendering
- Lucide React for icons
- Premium glassmorphism styling

### Backend
- Express.js server
- MCP SDK for server connections
- Generic tool handling with intelligent routing
- Dynamic parameter mapping

### MCP Servers

#### Calculator Server (Local Python)
**Tools:**
- `add` - Add two numbers
- `subtract` - Subtract two numbers
- `multiply` - Multiply two numbers
- `divide` - Divide two numbers
- `power` - Raise to power
- `sqrt` - Square root
- `modulo` - Remainder
- `abs` - Absolute value

**Example queries:**
- "add 5 and 3"
- "calculate 10 * 20"
- "what is the square root of 144"

#### GitHub Server (Docker)
Connect to GitHub repositories, search code, manage issues, etc.

**Example queries:**
- "search for issues in owner/repo"
- "show me recent commits"

#### Atlassian Server (Docker)
Interact with Jira and Confluence.

**Example queries:**
- "show me open tickets"
- "search confluence for documentation"

## How It Works

### Auto Mode (Intelligent Routing)

1. **Query Analysis**: Extracts keywords, numbers, and entities from your query
2. **Tool Scoring**: Scores all available tools based on:
   - Keyword matches in tool name/description
   - Parameter compatibility
   - Server availability
3. **Parameter Mapping**: Dynamically maps your query to tool parameters using input schemas
4. **Execution**: Calls the best-matching tool and returns formatted results

### Manual Mode

Directly connects to your selected server and uses only its tools.

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/servers` - Get server status
- `GET /api/tools` - List all available tools
- `POST /api/chat` - Send a message
  ```json
  {
    "message": "your query here",
    "mode": "auto" | "manual",
    "server": "calculator" | "github" | "atlassian"
  }
  ```

## Development

### Project Structure

```
mcp-ui/
├── backend/
│   ├── server.ts          # Express server
│   └── mcpManager.ts      # MCP connection manager
├── mcp-servers/
│   └── calculator-server.py  # Local calculator MCP server
├── src/
│   ├── App.tsx            # Main React component
│   ├── index.css          # Styling
│   └── main.tsx           # Entry point
├── package.json
└── .env.example
```

### Adding New MCP Servers

1. Add server configuration in `backend/mcpManager.ts` `initializeServers()` method
2. Add environment variables to `.env.example`
3. The generic tool handling will automatically work with any MCP-compliant server

## Troubleshooting

**Docker servers not connecting:**
- Ensure Docker is running
- Check that environment variables are set correctly
- Verify network connectivity

**Calculator server not working:**
- Ensure Python 3 is installed
- Check that the path to `calculator-server.py` is correct

**Markdown not rendering:**
- Clear browser cache
- Ensure `react-markdown` and `remark-gfm` are installed

## License

MIT

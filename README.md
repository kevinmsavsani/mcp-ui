# MCP Chatbot with React Router v7

A minimal chatbot connecting to three types of Model Context Protocol (MCP) servers.

## Prerequisites
- Node.js 20+
- Python 3
- Docker (for GitHub MCP server)

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

3. **Running the App**
   Start both frontend and backend concurrently:
   ```bash
   npm run dev
   ```

## Architecture
- **Frontend**: React Router v7 (SPA mode) with premium styling.
- **Backend**: Express.js server managing MCP client connections.
- **MCP Servers**:
  - `local-python`: Local Python script using `stdio` transport.
  - `github`: Docker image (`ghcr.io/github/github-mcp-server`) using `stdio`.
  - `atlassian`: SSE server endpoint.

## Features
- **Auto-routing**: Automatically tries servers in sequence.
- **Manual Mode**: Direct connection to a specific server.
- **Real-time Status**: Monitors connection health of all servers.
- **Optimized UI**: Responsive, glassmorphism design with Lucide-style aesthetics.
# mcp-ui

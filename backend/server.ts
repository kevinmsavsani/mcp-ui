import express from 'express';
import cors from 'cors';
import { MCPManager } from './mcpManager.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());

const mcpManager = new MCPManager();

// Initialize MCP servers on startup
let initialized = false;

async function initializeMCP() {
    if (!initialized) {
        await mcpManager.initializeServers();
        initialized = true;
    }
}

// Health check
app.get('/api/health', (req: any, res: any) => {
    res.json({ status: 'ok' });
});

// Get server status
app.get('/api/servers', async (req: any, res: any) => {
    try {
        await initializeMCP();
        const status = mcpManager.getServerStatus();
        res.json(status);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// List all tools
app.get('/api/tools', async (req: any, res: any) => {
    try {
        await initializeMCP();
        const tools = await mcpManager.listAllTools();
        res.json(tools);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Send chat message
app.post('/api/chat', async (req: any, res: any) => {
    try {
        await initializeMCP();
        const { message, server, mode } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        let result;

        if (mode === 'manual' && server) {
            // Manual server selection
            result = await mcpManager.sendMessage(server, message);
        } else {
            // Auto-routing
            result = await mcpManager.autoRoute(message);
        }

        res.json(result);
    } catch (error: any) {
        console.error('Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await mcpManager.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down...');
    await mcpManager.cleanup();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});

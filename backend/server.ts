import express from 'express';
import cors from 'cors';
import { MCPManager } from './mcpManager.js';
import { logger, perfMonitor } from './utils/logger.js';
import { healthChecker } from './utils/healthCheck.js';
import { ChatRequest, ChatResponse, ErrorResponse } from './types/index.js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors());
app.use(express.json());

// Request ID middleware
app.use((req: any, res: any, next: any) => {
    req.requestId = uuidv4();
    res.setHeader('X-Request-ID', req.requestId);
    next();
});

// Request logging middleware
app.use((req: any, res: any, next: any) => {
    const endTimer = perfMonitor.startTimer('http_request');

    logger.info('Incoming request', {
        component: 'Server',
        method: req.method,
        path: req.path,
        requestId: req.requestId,
        ip: req.ip
    });

    res.on('finish', () => {
        const duration = endTimer();
        logger.info('Request completed', {
            component: 'Server',
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            requestId: req.requestId,
            duration
        });
    });

    next();
});

const mcpManager = new MCPManager();
healthChecker.setMCPManager(mcpManager);

// Initialize MCP servers on startup
let initialized = false;

async function initializeMCP() {
    if (!initialized) {
        try {
            await mcpManager.initializeServers();
            initialized = true;
            logger.info('MCP servers initialized successfully', { component: 'Server' });
        } catch (error: any) {
            logger.error('Failed to initialize MCP servers', { component: 'Server' }, error);
            throw error;
        }
    }
}

// Health check endpoint
app.get('/api/health', async (req: any, res: any) => {
    try {
        const health = await healthChecker.getHealthStatus();
        const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
        res.status(statusCode).json(health);
    } catch (error: any) {
        logger.error('Health check failed', { component: 'Server', requestId: req.requestId }, error);
        res.status(500).json({ error: 'Health check failed' });
    }
});

// Detailed diagnostics endpoint (for debugging)
app.get('/api/diagnostics', async (req: any, res: any) => {
    try {
        const diagnostics = await healthChecker.getDetailedDiagnostics();
        res.json(diagnostics);
    } catch (error: any) {
        logger.error('Diagnostics failed', { component: 'Server', requestId: req.requestId }, error);
        res.status(500).json({ error: 'Diagnostics failed' });
    }
});

// Performance metrics endpoint
app.get('/api/metrics', (req: any, res: any) => {
    try {
        const stats = perfMonitor.getAllStats();
        res.json({
            timestamp: new Date().toISOString(),
            metrics: stats
        });
    } catch (error: any) {
        logger.error('Metrics retrieval failed', { component: 'Server', requestId: req.requestId }, error);
        res.status(500).json({ error: 'Metrics retrieval failed' });
    }
});

// Logs endpoint (for debugging - should be protected in production)
app.get('/api/logs', (req: any, res: any) => {
    try {
        const count = parseInt(req.query.count as string) || 100;
        const logs = logger.getRecentLogs(count);
        res.json({
            count: logs.length,
            logs
        });
    } catch (error: any) {
        logger.error('Log retrieval failed', { component: 'Server', requestId: req.requestId }, error);
        res.status(500).json({ error: 'Log retrieval failed' });
    }
});

// Get server status
app.get('/api/servers', async (req: any, res: any) => {
    try {
        await initializeMCP();
        const status = mcpManager.getServerStatus();
        res.json(status);
    } catch (error: any) {
        logger.error('Failed to get server status', { component: 'Server', requestId: req.requestId }, error);
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
        logger.error('Failed to list tools', { component: 'Server', requestId: req.requestId }, error);
        res.status(500).json({ error: error.message });
    }
});

// Send chat message
app.post('/api/chat', async (req: any, res: any) => {
    const endTimer = perfMonitor.startTimer('chat_request');

    try {
        await initializeMCP();
        const { message, server, mode }: ChatRequest = req.body;

        if (!message) {
            logger.warn('Chat request missing message', { component: 'Server', requestId: req.requestId });
            return res.status(400).json({ error: 'Message is required' } as ErrorResponse);
        }

        logger.info('Processing chat request', {
            component: 'Server',
            mode,
            server,
            messageLength: message.length,
            requestId: req.requestId
        });

        let result;

        if (mode === 'manual' && server) {
            // Manual server selection
            result = await mcpManager.sendMessage(server, message);
        } else {
            // Auto-routing
            result = await mcpManager.autoRoute(message);
        }

        const duration = endTimer();

        const response: ChatResponse = {
            ...result,
            requestId: req.requestId,
            duration
        };

        logger.info('Chat request successful', {
            component: 'Server',
            mode,
            server: result.server,
            tool: result.tool,
            requestId: req.requestId,
            duration
        });

        res.json(response);
    } catch (error: any) {
        const duration = endTimer();
        logger.error('Chat request failed', {
            component: 'Server',
            requestId: req.requestId,
            duration
        }, error);

        res.status(500).json({
            error: error.message,
            requestId: req.requestId
        } as ErrorResponse);
    }
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
    logger.error('Unhandled error', {
        component: 'Server',
        requestId: req.requestId,
        path: req.path
    }, err);

    res.status(500).json({
        error: 'Internal server error',
        requestId: req.requestId
    } as ErrorResponse);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`, { component: 'Server' });

    try {
        await mcpManager.cleanup();
        logger.info('MCP cleanup complete', { component: 'Server' });
        process.exit(0);
    } catch (error: any) {
        logger.error('Error during shutdown', { component: 'Server' }, error);
        process.exit(1);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
        component: 'Server',
        reason: reason?.message || reason
    }, reason);
});

// Uncaught exception handler
process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', { component: 'Server' }, error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

app.listen(PORT, () => {
    logger.info(`🚀 Backend server running`, {
        component: 'Server',
        port: PORT,
        env: NODE_ENV,
        nodeVersion: process.version
    });
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📈 Metrics: http://localhost:${PORT}/api/metrics`);
    console.log(`🔍 Diagnostics: http://localhost:${PORT}/api/diagnostics`);
});

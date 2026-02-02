/**
 * Health check and monitoring utilities
 * Provides comprehensive system health information
 */

import { MCPManager } from '../mcpManager.js';
import { logger } from './logger.js';

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    services: {
        backend: ServiceHealth;
        mcpServers: Record<string, ServerHealth>;
    };
    system: SystemMetrics;
}

export interface ServiceHealth {
    status: 'up' | 'down';
    message?: string;
}

export interface ServerHealth {
    connected: boolean;
    toolCount: number;
    lastCheck: string;
    readOnly?: boolean;
    errors?: string[];
}

export interface SystemMetrics {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    processUptime: number;
}

export class HealthChecker {
    private startTime: number;
    private mcpManager: MCPManager | null = null;

    constructor() {
        this.startTime = Date.now();
    }

    setMCPManager(manager: MCPManager) {
        this.mcpManager = manager;
    }

    async getHealthStatus(): Promise<HealthStatus> {
        const timestamp = new Date().toISOString();
        const uptime = Date.now() - this.startTime;

        // Check backend service
        const backendHealth: ServiceHealth = {
            status: 'up',
            message: 'Backend service is running'
        };

        // Check MCP servers
        const mcpServers: Record<string, ServerHealth> = {};
        if (this.mcpManager) {
            try {
                const serverStatus = this.mcpManager.getServerStatus();
                const allTools = await this.mcpManager.listAllTools();

                for (const [name, status] of Object.entries(serverStatus)) {
                    mcpServers[name] = {
                        connected: status.connected,
                        toolCount: allTools[name]?.length || 0,
                        lastCheck: timestamp,
                        readOnly: status.readOnly,
                        errors: status.error ? [status.error] : undefined
                    };
                }
            } catch (error: any) {
                logger.error('Failed to get MCP server status', { component: 'HealthChecker' }, error);
                backendHealth.status = 'down';
                backendHealth.message = 'Failed to check MCP servers';
            }
        }

        // Get system metrics
        const systemMetrics: SystemMetrics = {
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            processUptime: process.uptime()
        };

        // Determine overall status
        const connectedServers = Object.values(mcpServers).filter(s => s.connected).length;
        const totalServers = Object.keys(mcpServers).length;

        let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
        if (backendHealth.status === 'down') {
            overallStatus = 'unhealthy';
        } else if (connectedServers === 0 && totalServers > 0) {
            overallStatus = 'degraded'; // Changed from unhealthy to allow startup
        } else if (connectedServers < totalServers) {
            overallStatus = 'degraded';
        } else {
            overallStatus = 'healthy';
        }

        return {
            status: overallStatus,
            timestamp,
            uptime,
            version: process.env.npm_package_version || '1.0.0',
            services: {
                backend: backendHealth,
                mcpServers
            },
            system: systemMetrics
        };
    }

    async getDetailedDiagnostics(): Promise<any> {
        const health = await this.getHealthStatus();

        return {
            ...health,
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                env: process.env.NODE_ENV || 'development'
            },
            configuration: {
                logLevel: process.env.LOG_LEVEL || 'INFO',
                backendPort: process.env.BACKEND_PORT || 3001,
                mcpReadOnlyMode: process.env.MCP_READ_ONLY_MODE || 'true',
                mcpMaxSteps: process.env.MCP_MAX_STEPS || '15'
            }
        };
    }
}

export const healthChecker = new HealthChecker();

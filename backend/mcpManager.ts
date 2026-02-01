import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { spawn } from "child_process";

export interface MCPServer {
    name: string;
    client: Client;
    connected: boolean;
    type: 'stdio' | 'sse';
}

export class MCPManager {
    private servers: Map<string, MCPServer> = new Map();

    async initializeServers() {
        console.log('🚀 Initializing MCP servers...');

        // 1. Local Python MCP Server
        await this.connectStdioServer(
            'local-python',
            'python3',
            [process.env.LOCAL_MCP_SERVER_PATH || './mcp-servers/local-server.py']
        );

        // 2. GitHub Docker MCP Server
        await this.connectStdioServer(
            'github',
            'docker',
            [
                'run',
                '-i',
                '--rm',
                '-e',
                'GITHUB_PERSONAL_ACCESS_TOKEN',
                '-e',
                'GITHUB_HOST',
                'ghcr.io/github/github-mcp-server'
            ],
            {
                GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '',
                GITHUB_HOST: process.env.GITHUB_HOST || 'https://github.com'
            }
        );

        // 3. Atlassian SSE Server
        if (process.env.ATLASSIAN_SSE_URL) {
            await this.connectSSEServer(
                'atlassian',
                process.env.ATLASSIAN_SSE_URL,
                process.env.ATLASSIAN_API_TOKEN
            );
        }

        console.log(`✅ Connected to ${this.servers.size} MCP servers`);
    }

    private async connectStdioServer(
        name: string,
        command: string,
        args: string[],
        env?: Record<string, string>
    ) {
        try {
            const client = new Client({
                name: `mcp-chatbot-${name}`,
                version: "1.0.0"
            }, {
                capabilities: {}
            });

            const transport = new StdioClientTransport({
                command,
                args,
                env: { ...process.env, ...env }
            });

            await client.connect(transport);

            this.servers.set(name, {
                name,
                client,
                connected: true,
                type: 'stdio'
            });

            console.log(`✅ Connected to ${name} MCP server (stdio)`);
        } catch (error) {
            console.error(`❌ Failed to connect to ${name}:`, error);
            this.servers.set(name, {
                name,
                client: null as any,
                connected: false,
                type: 'stdio'
            });
        }
    }

    private async connectSSEServer(
        name: string,
        url: string,
        apiToken?: string
    ) {
        try {
            const client = new Client({
                name: `mcp-chatbot-${name}`,
                version: "1.0.0"
            }, {
                capabilities: {}
            });

            const headers: Record<string, string> = {};
            if (apiToken) {
                headers['Authorization'] = `Bearer ${apiToken}`;
            }

            const transport = new SSEClientTransport(new URL(url));

            await client.connect(transport);

            this.servers.set(name, {
                name,
                client,
                connected: true,
                type: 'sse'
            });

            console.log(`✅ Connected to ${name} MCP server (SSE)`);
        } catch (error) {
            console.error(`❌ Failed to connect to ${name}:`, error);
            this.servers.set(name, {
                name,
                client: null as any,
                connected: false,
                type: 'sse'
            });
        }
    }

    async sendMessage(serverName: string, message: string): Promise<any> {
        const server = this.servers.get(serverName);

        if (!server || !server.connected) {
            throw new Error(`Server ${serverName} is not connected`);
        }

        try {
            // List available tools
            const tools = await server.client.listTools();

            if (tools.tools.length === 0) {
                return {
                    response: `Server ${serverName} has no tools available`,
                    server: serverName
                };
            }

            // Call the first available tool with the message
            const tool = tools.tools[0];
            const result = await server.client.callTool({
                name: tool.name,
                arguments: { message }
            });

            return {
                response: result.content,
                server: serverName,
                tool: tool.name
            };
        } catch (error: any) {
            console.error(`Error calling ${serverName}:`, error);
            throw new Error(`Failed to process message on ${serverName}: ${error.message}`);
        }
    }

    async autoRoute(message: string): Promise<any> {
        // Try servers in order: local-python -> github -> atlassian
        const serverOrder = ['local-python', 'github', 'atlassian'];

        for (const serverName of serverOrder) {
            const server = this.servers.get(serverName);
            if (server && server.connected) {
                try {
                    return await this.sendMessage(serverName, message);
                } catch (error) {
                    console.log(`Failed on ${serverName}, trying next...`);
                    continue;
                }
            }
        }

        throw new Error('No MCP servers available');
    }

    getServerStatus() {
        const status: Record<string, any> = {};

        this.servers.forEach((server, name) => {
            status[name] = {
                connected: server.connected,
                type: server.type
            };
        });

        return status;
    }

    async listAllTools() {
        const allTools: Record<string, any[]> = {};

        for (const [name, server] of this.servers) {
            if (server.connected) {
                try {
                    const tools = await server.client.listTools();
                    allTools[name] = tools.tools;
                } catch (error) {
                    allTools[name] = [];
                }
            } else {
                allTools[name] = [];
            }
        }

        return allTools;
    }

    async cleanup() {
        for (const [name, server] of this.servers) {
            if (server.connected) {
                try {
                    await server.client.close();
                    console.log(`Closed connection to ${name}`);
                } catch (error) {
                    console.error(`Error closing ${name}:`, error);
                }
            }
        }
        this.servers.clear();
    }
}

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface MCPServer {
    name: string;
    client: Client;
    connected: boolean;
    type: 'stdio';
}

export interface ToolInfo {
    name: string;
    description: string;
    inputSchema: any;
    serverName: string;
}

export interface ToolCallResult {
    response: string;
    server: string;
    tool: string;
    steps?: string[];
}

export class MCPManager {
    private servers: Map<string, MCPServer> = new Map();
    private toolCache: Map<string, ToolInfo[]> = new Map();

    async initializeServers() {
        console.log('🚀 Initializing MCP servers...');

        // 1. Calculator MCP Server (Local Python)
        await this.connectStdioServer(
            'calculator',
            'python3',
            [process.env.CALCULATOR_SERVER_PATH || './mcp-servers/calculator-server.py']
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

        // 3. Atlassian Docker MCP Server
        await this.connectStdioServer(
            'atlassian',
            'docker',
            [
                'run',
                '-i',
                '--rm',
                '-e',
                'ATLASSIAN_URL',
                '-e',
                'ATLASSIAN_API_TOKEN',
                '-e',
                'ATLASSIAN_EMAIL',
                'ghcr.io/sooperset/mcp-atlassian:latest'
            ],
            {
                ATLASSIAN_URL: process.env.ATLASSIAN_URL || '',
                ATLASSIAN_API_TOKEN: process.env.ATLASSIAN_API_TOKEN || '',
                ATLASSIAN_EMAIL: process.env.ATLASSIAN_EMAIL || ''
            }
        );

        console.log(`✅ Connected to ${this.servers.size} MCP servers`);

        // Cache all tools
        await this.cacheAllTools();
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

            const mergedEnv: Record<string, string> = {};
            for (const [key, value] of Object.entries(process.env)) {
                if (value !== undefined) {
                    mergedEnv[key] = value;
                }
            }
            if (env) {
                Object.assign(mergedEnv, env);
            }

            const transport = new StdioClientTransport({
                command,
                args,
                env: mergedEnv
            });

            await client.connect(transport);

            this.servers.set(name, {
                name,
                client,
                connected: true,
                type: 'stdio'
            });

            console.log(`✅ Connected to ${name} MCP server (stdio, read-only mode)`);
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

    private async cacheAllTools() {
        for (const [name, server] of this.servers) {
            if (server.connected) {
                try {
                    const tools = await server.client.listTools();
                    const toolInfos: ToolInfo[] = tools.tools.map((tool: any) => ({
                        name: tool.name,
                        description: tool.description || '',
                        inputSchema: tool.inputSchema || {},
                        serverName: name
                    }));
                    this.toolCache.set(name, toolInfos);
                    console.log(`📦 Cached ${toolInfos.length} tools from ${name}`);
                } catch (error) {
                    console.error(`Failed to cache tools from ${name}:`, error);
                    this.toolCache.set(name, []);
                }
            }
        }
    }

    /**
     * Extract numbers from a query string
     */
    private extractNumbers(query: string): number[] {
        const numberPattern = /-?\d+\.?\d*/g;
        const matches = query.match(numberPattern);
        return matches ? matches.map(n => parseFloat(n)) : [];
    }

    /**
     * Extract keywords from query for tool matching
     */
    private extractKeywords(query: string): string[] {
        const lowerQuery = query.toLowerCase();
        const keywords: string[] = [];

        // Math operation keywords
        const mathKeywords = ['add', 'sum', 'plus', 'subtract', 'minus', 'multiply', 'times', 'divide',
            'power', 'sqrt', 'square root', 'modulo', 'mod', 'remainder', 'absolute', 'abs'];

        // GitHub keywords
        const githubKeywords = ['github', 'repository', 'repo', 'issue', 'pull request', 'pr', 'commit',
            'branch', 'file', 'search', 'code'];

        // Atlassian keywords
        const atlassianKeywords = ['jira', 'confluence', 'atlassian', 'ticket', 'project', 'sprint',
            'board', 'wiki', 'page'];

        const allKeywords = [...mathKeywords, ...githubKeywords, ...atlassianKeywords];

        for (const keyword of allKeywords) {
            if (lowerQuery.includes(keyword)) {
                keywords.push(keyword);
            }
        }

        return keywords;
    }

    /**
     * Map query to tool parameters based on input schema
     */
    private mapQueryToParameters(query: string, tool: ToolInfo): Record<string, any> {
        const params: Record<string, any> = {};
        const schema = tool.inputSchema;

        if (!schema || !schema.properties) {
            return { query };
        }

        const numbers = this.extractNumbers(query);
        const lowerQuery = query.toLowerCase();

        // Map parameters based on schema
        const properties = schema.properties;
        let numberIndex = 0;

        for (const [paramName, paramDef] of Object.entries(properties)) {
            const def = paramDef as any;

            if (def.type === 'number') {
                // Map numbers in order
                if (numberIndex < numbers.length) {
                    params[paramName] = numbers[numberIndex];
                    numberIndex++;
                }
            } else if (def.type === 'string') {
                // For string parameters, try to extract relevant parts
                if (paramName === 'message' || paramName === 'query' || paramName === 'text') {
                    params[paramName] = query;
                } else if (paramName === 'repository' || paramName === 'repo') {
                    // Extract repo name (e.g., "owner/repo")
                    const repoMatch = query.match(/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/);
                    if (repoMatch) params[paramName] = repoMatch[1];
                } else if (paramName === 'issue_number' || paramName === 'issueNumber') {
                    // Extract issue number
                    const issueMatch = query.match(/#(\d+)/);
                    if (issueMatch) params[paramName] = issueMatch[1];
                } else {
                    // Default to full query
                    params[paramName] = query;
                }
            } else if (def.type === 'boolean') {
                // Check for boolean indicators
                params[paramName] = lowerQuery.includes('true') || lowerQuery.includes('yes');
            }
        }

        return params;
    }

    /**
     * Score a tool based on how well it matches the query
     */
    private scoreTool(tool: ToolInfo, query: string, keywords: string[]): number {
        let score = 0;
        const lowerQuery = query.toLowerCase();
        const toolNameLower = tool.name.toLowerCase();
        const toolDescLower = tool.description.toLowerCase();

        // Exact tool name match
        if (lowerQuery.includes(toolNameLower)) {
            score += 50;
        }

        // Keyword matches in tool name
        for (const keyword of keywords) {
            if (toolNameLower.includes(keyword)) {
                score += 30;
            }
            if (toolDescLower.includes(keyword)) {
                score += 10;
            }
        }

        // Math operation detection
        const numbers = this.extractNumbers(query);
        if (numbers.length >= 2 && ['add', 'subtract', 'multiply', 'divide', 'power', 'modulo'].includes(toolNameLower)) {
            score += 20;
        }
        if (numbers.length === 1 && ['sqrt', 'abs'].includes(toolNameLower)) {
            score += 20;
        }

        // Server priority bonus (prefer calculator for math, etc.)
        if (tool.serverName === 'calculator' && numbers.length > 0) {
            score += 15;
        }
        if (tool.serverName === 'github' && keywords.some(k => ['github', 'repo', 'code'].includes(k))) {
            score += 15;
        }
        if (tool.serverName === 'atlassian' && keywords.some(k => ['jira', 'confluence', 'atlassian'].includes(k))) {
            score += 15;
        }

        return score;
    }

    /**
     * Select the best tool for a query from all available tools
     */
    private selectBestTool(query: string, serverName?: string): ToolInfo | null {
        const keywords = this.extractKeywords(query);
        let allTools: ToolInfo[] = [];

        if (serverName) {
            // Manual mode: only use tools from selected server
            allTools = this.toolCache.get(serverName) || [];
        } else {
            // Auto mode: use all tools from all servers
            for (const tools of this.toolCache.values()) {
                allTools.push(...tools);
            }
        }

        if (allTools.length === 0) {
            return null;
        }

        // Score all tools
        const scoredTools = allTools.map(tool => ({
            tool,
            score: this.scoreTool(tool, query, keywords)
        }));

        // Sort by score (highest first)
        scoredTools.sort((a, b) => b.score - a.score);

        console.log(`🎯 Tool selection for "${query}":`);
        scoredTools.slice(0, 3).forEach(({ tool, score }) => {
            console.log(`  - ${tool.serverName}:${tool.name} (score: ${score})`);
        });

        return scoredTools[0].score > 0 ? scoredTools[0].tool : scoredTools[0].tool;
    }

    /**
     * Call a specific tool with mapped parameters
     */
    private async callTool(tool: ToolInfo, params: Record<string, any>): Promise<any> {
        const server = this.servers.get(tool.serverName);

        if (!server || !server.connected) {
            throw new Error(`Server ${tool.serverName} is not connected`);
        }

        console.log(`🔧 Calling tool: ${tool.serverName}:${tool.name}`);
        console.log(`📝 Parameters:`, JSON.stringify(params, null, 2));

        const result = await server.client.callTool({
            name: tool.name,
            arguments: params
        });

        return result;
    }

    /**
     * Format tool response as markdown
     */
    private formatResponse(result: any, tool: ToolInfo): string {
        if (!result.content) {
            return 'No response from tool';
        }

        // Extract text from content array
        const textParts = result.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text);

        return textParts.join('\n\n');
    }

    /**
     * Send message to a specific server (manual mode)
     */
    async sendMessage(serverName: string, message: string): Promise<ToolCallResult> {
        const server = this.servers.get(serverName);

        if (!server || !server.connected) {
            throw new Error(`Server ${serverName} is not connected`);
        }

        // Select best tool from this server
        const tool = this.selectBestTool(message, serverName);

        if (!tool) {
            return {
                response: `No suitable tools found on server ${serverName}`,
                server: serverName,
                tool: 'none'
            };
        }

        // Map query to parameters
        const params = this.mapQueryToParameters(message, tool);

        // Call the tool
        const result = await this.callTool(tool, params);

        // Format response
        const response = this.formatResponse(result, tool);

        return {
            response,
            server: serverName,
            tool: tool.name
        };
    }

    /**
     * Auto-route message to best available tool (auto mode)
     */
    async autoRoute(message: string): Promise<ToolCallResult> {
        // Select best tool from all servers
        const tool = this.selectBestTool(message);

        if (!tool) {
            throw new Error('No suitable tools found across all servers');
        }

        // Map query to parameters
        const params = this.mapQueryToParameters(message, tool);

        // Call the tool
        const result = await this.callTool(tool, params);

        // Format response
        const response = this.formatResponse(result, tool);

        return {
            response,
            server: tool.serverName,
            tool: tool.name
        };
    }

    getServerStatus() {
        const status: Record<string, any> = {};

        this.servers.forEach((server, name) => {
            const tools = this.toolCache.get(name) || [];
            status[name] = {
                connected: server.connected,
                type: server.type,
                toolCount: tools.length
            };
        });

        return status;
    }

    async listAllTools() {
        const allTools: Record<string, any[]> = {};

        for (const [name, tools] of this.toolCache) {
            allTools[name] = tools.map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema
            }));
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
        this.toolCache.clear();
    }
}

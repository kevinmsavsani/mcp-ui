import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger, perfMonitor } from './utils/logger.js';
import { ServerConfig, MCPServer, ToolInfo, ToolCallResult } from './types/index.js';

export class MCPManager {
    private servers: Map<string, MCPServer> = new Map();
    private toolCache: Map<string, ToolInfo[]> = new Map();
    private serverConfigs: ServerConfig[] = [];

    constructor() {
        logger.info('MCPManager initialized', { component: 'MCPManager' });
    }

    async initializeServers() {
        const endTimer = perfMonitor.startTimer('mcp_initialization');
        logger.info('🚀 Initializing MCP servers...', { component: 'MCPManager' });

        // Define server configurations
        this.serverConfigs = [
            {
                name: 'calculator',
                command: 'python3',
                args: [process.env.CALCULATOR_SERVER_PATH || './mcp-servers/calculator-server.py'],
                env: {},
                readOnly: true
            },
            {
                name: 'github',
                command: 'docker',
                args: [
                    'run', '-i', '--rm',
                    '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN',
                    '-e', 'GITHUB_HOST',
                    'ghcr.io/github/github-mcp-server'
                ],
                env: {
                    GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '',
                    GITHUB_HOST: process.env.GITHUB_HOST || 'https://github.com'
                },
                readOnly: true
            },
            {
                name: 'atlassian',
                command: 'docker',
                args: [
                    'run', '-i', '--rm',
                    '-e', 'CONFLUENCE_URL',
                    '-e', 'CONFLUENCE_USERNAME',
                    '-e', 'CONFLUENCE_API_TOKEN',
                    '-e', 'JIRA_URL',
                    '-e', 'JIRA_USERNAME',
                    '-e', 'JIRA_API_TOKEN',
                    'ghcr.io/sooperset/mcp-atlassian:latest'
                ],
                env: {
                    CONFLUENCE_URL: process.env.CONFLUENCE_URL || '',
                    CONFLUENCE_USERNAME: process.env.CONFLUENCE_USERNAME || '',
                    CONFLUENCE_API_TOKEN: process.env.CONFLUENCE_API_TOKEN || '',
                    JIRA_URL: process.env.JIRA_URL || '',
                    JIRA_USERNAME: process.env.JIRA_USERNAME || '',
                    JIRA_API_TOKEN: process.env.JIRA_API_TOKEN || ''
                },
                readOnly: true
            }
        ];

        // Connect to all servers
        const connectionPromises = this.serverConfigs.map(config =>
            this.connectStdioServer(config)
        );

        await Promise.allSettled(connectionPromises);

        const duration = endTimer();
        const connectedCount = Array.from(this.servers.values()).filter(s => s.connected).length;

        logger.info(`✅ MCP initialization complete`, {
            component: 'MCPManager',
            connectedServers: connectedCount,
            totalServers: this.serverConfigs.length,
            duration
        });

        // Cache all tools
        await this.cacheAllTools();
    }

    private async connectStdioServer(config: ServerConfig) {
        const endTimer = perfMonitor.startTimer(`server_connect_${config.name}`);

        try {
            logger.debug(`Connecting to ${config.name} server...`, {
                component: 'MCPManager',
                server: config.name,
                command: config.command
            });

            const client = new Client({
                name: `mcp-chatbot-${config.name}`,
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
            if (config.env) {
                Object.assign(mergedEnv, config.env);
            }

            const transport = new StdioClientTransport({
                command: config.command,
                args: config.args,
                env: mergedEnv
            });

            await client.connect(transport);

            this.servers.set(config.name, {
                name: config.name,
                client,
                connected: true,
                type: 'stdio',
                readOnly: config.readOnly
            });

            const duration = endTimer();
            logger.info(`✅ Connected to ${config.name} MCP server`, {
                component: 'MCPManager',
                server: config.name,
                type: 'stdio',
                readOnly: config.readOnly,
                duration
            });
        } catch (error: any) {
            const duration = endTimer();
            logger.error(`❌ Failed to connect to ${config.name}`, {
                component: 'MCPManager',
                server: config.name,
                duration
            }, error);

            this.servers.set(config.name, {
                name: config.name,
                client: null as any,
                connected: false,
                type: 'stdio',
                readOnly: config.readOnly,
                error: error.message
            });
        }
    }

    private async cacheAllTools() {
        const endTimer = perfMonitor.startTimer('cache_all_tools');

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

                    logger.debug(`📦 Cached tools from ${name}`, {
                        component: 'MCPManager',
                        server: name,
                        toolCount: toolInfos.length
                    });
                } catch (error: any) {
                    logger.error(`Failed to cache tools from ${name}`, {
                        component: 'MCPManager',
                        server: name
                    }, error);
                    this.toolCache.set(name, []);
                }
            }
        }

        const duration = endTimer();
        const totalTools = Array.from(this.toolCache.values()).reduce((sum, tools) => sum + tools.length, 0);

        logger.info(`Tool caching complete`, {
            component: 'MCPManager',
            totalTools,
            duration
        });
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

        logger.debug('Mapping query to parameters', {
            component: 'MCPManager',
            tool: tool.name,
            server: tool.serverName,
            query
        });

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

        logger.debug('Parameter mapping complete', {
            component: 'MCPManager',
            tool: tool.name,
            params
        });

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
        const endTimer = perfMonitor.startTimer('tool_selection');
        const keywords = this.extractKeywords(query);
        let allTools: ToolInfo[] = [];

        if (serverName) {
            // Manual mode: only use tools from selected server
            allTools = this.toolCache.get(serverName) || [];
            logger.debug('Manual mode: selecting from specific server', {
                component: 'MCPManager',
                server: serverName,
                availableTools: allTools.length
            });
        } else {
            // Auto mode: use all tools from all servers
            for (const tools of this.toolCache.values()) {
                allTools.push(...tools);
            }
            logger.debug('Auto mode: selecting from all servers', {
                component: 'MCPManager',
                availableTools: allTools.length
            });
        }

        if (allTools.length === 0) {
            logger.warn('No tools available for selection', {
                component: 'MCPManager',
                serverName
            });
            return null;
        }

        // Score all tools
        const scoredTools = allTools.map(tool => ({
            tool,
            score: this.scoreTool(tool, query, keywords)
        }));

        // Sort by score (highest first)
        scoredTools.sort((a, b) => b.score - a.score);

        const duration = endTimer();
        const selectedTool = scoredTools[0].score > 0 ? scoredTools[0].tool : scoredTools[0].tool;

        logger.info(`🎯 Tool selected`, {
            component: 'MCPManager',
            query,
            selectedTool: `${selectedTool.serverName}:${selectedTool.name}`,
            score: scoredTools[0].score,
            duration,
            topCandidates: scoredTools.slice(0, 3).map(({ tool, score }) => ({
                tool: `${tool.serverName}:${tool.name}`,
                score
            }))
        });

        return selectedTool;
    }

    /**
     * Call a specific tool with mapped parameters
     */
    private async callTool(tool: ToolInfo, params: Record<string, any>): Promise<any> {
        const endTimer = perfMonitor.startTimer(`tool_call_${tool.name}`);
        const server = this.servers.get(tool.serverName);

        if (!server || !server.connected) {
            throw new Error(`Server ${tool.serverName} is not connected`);
        }

        logger.info(`🔧 Calling tool`, {
            component: 'MCPManager',
            server: tool.serverName,
            tool: tool.name,
            params
        });

        try {
            const result = await server.client.callTool({
                name: tool.name,
                arguments: params
            });

            const duration = endTimer();
            logger.info(`✅ Tool call successful`, {
                component: 'MCPManager',
                server: tool.serverName,
                tool: tool.name,
                duration
            });

            return result;
        } catch (error: any) {
            const duration = endTimer();
            logger.error(`❌ Tool call failed`, {
                component: 'MCPManager',
                server: tool.serverName,
                tool: tool.name,
                duration
            }, error);
            throw error;
        }
    }

    /**
     * Format tool response as markdown
     */
    private formatResponse(result: any, tool: ToolInfo): string {
        if (!result.content) {
            logger.warn('Tool returned no content', {
                component: 'MCPManager',
                tool: tool.name
            });
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
        const endTimer = perfMonitor.startTimer('send_message_manual');

        logger.info('Processing message in manual mode', {
            component: 'MCPManager',
            server: serverName,
            messageLength: message.length
        });

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

        const duration = endTimer();
        logger.info('Message processed successfully', {
            component: 'MCPManager',
            mode: 'manual',
            server: serverName,
            tool: tool.name,
            duration
        });

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
        const endTimer = perfMonitor.startTimer('auto_route');

        logger.info('Processing message in auto mode', {
            component: 'MCPManager',
            messageLength: message.length
        });

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

        const duration = endTimer();
        logger.info('Message processed successfully', {
            component: 'MCPManager',
            mode: 'auto',
            server: tool.serverName,
            tool: tool.name,
            duration
        });

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
                toolCount: tools.length,
                readOnly: server.readOnly,
                error: server.error
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
        logger.info('Cleaning up MCP connections', { component: 'MCPManager' });

        for (const [name, server] of this.servers) {
            if (server.connected) {
                try {
                    await server.client.close();
                    logger.info(`Closed connection to ${name}`, {
                        component: 'MCPManager',
                        server: name
                    });
                } catch (error: any) {
                    logger.error(`Error closing ${name}`, {
                        component: 'MCPManager',
                        server: name
                    }, error);
                }
            }
        }
        this.servers.clear();
        this.toolCache.clear();

        logger.info('MCP cleanup complete', { component: 'MCPManager' });
    }
}

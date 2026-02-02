/**
 * Type definitions for MCP UI backend
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export interface MCPServer {
    name: string;
    client: Client;
    connected: boolean;
    type: 'stdio';
    readOnly?: boolean;
    error?: string;
}

export interface ServerConfig {
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    readOnly: boolean;
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

export interface ChatRequest {
    message: string;
    mode: 'auto' | 'manual';
    server?: string;
    requestId?: string;
}

export interface ChatResponse {
    response: string;
    server: string;
    tool: string;
    requestId?: string;
    duration?: number;
}

export interface ErrorResponse {
    error: string;
    code?: string;
    requestId?: string;
}

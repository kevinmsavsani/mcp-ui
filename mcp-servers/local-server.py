#!/usr/bin/env python3
"""
Simple local MCP server for testing
"""
import json
import sys
from typing import Any

def send_message(message: dict[str, Any]) -> None:
    """Send a JSON-RPC message to stdout"""
    json.dump(message, sys.stdout)
    sys.stdout.write('\n')
    sys.stdout.flush()

def handle_initialize(request_id: Any) -> None:
    """Handle initialize request"""
    send_message({
        "jsonrpc": "2.0",
        "id": request_id,
        "result": {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "serverInfo": {
                "name": "local-python-server",
                "version": "1.0.0"
            }
        }
    })

def handle_list_tools(request_id: Any) -> None:
    """Handle tools/list request"""
    send_message({
        "jsonrpc": "2.0",
        "id": request_id,
        "result": {
            "tools": [
                {
                    "name": "echo",
                    "description": "Echo back the message",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "message": {
                                "type": "string",
                                "description": "Message to echo"
                            }
                        },
                        "required": ["message"]
                    }
                }
            ]
        }
    })

def handle_call_tool(request_id: Any, params: dict) -> None:
    """Handle tools/call request"""
    tool_name = params.get("name")
    arguments = params.get("arguments", {})
    
    if tool_name == "echo":
        message = arguments.get("message", "")
        send_message({
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": f"[Local Python Server] Echo: {message}"
                    }
                ]
            }
        })
    else:
        send_message({
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": -32601,
                "message": f"Unknown tool: {tool_name}"
            }
        })

def main():
    """Main server loop"""
    # Send server info on stderr for debugging
    print("Local Python MCP Server started", file=sys.stderr)
    
    for line in sys.stdin:
        try:
            request = json.loads(line)
            method = request.get("method")
            request_id = request.get("id")
            params = request.get("params", {})
            
            if method == "initialize":
                handle_initialize(request_id)
            elif method == "tools/list":
                handle_list_tools(request_id)
            elif method == "tools/call":
                handle_call_tool(request_id, params)
            else:
                # Unknown method
                send_message({
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {method}"
                    }
                })
        except Exception as e:
            print(f"Error processing request: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()

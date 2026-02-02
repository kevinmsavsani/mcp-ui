#!/usr/bin/env python3
"""
Calculator MCP Server
Provides basic mathematical operations through MCP protocol
"""
import json
import sys
import math
from typing import Any, Dict

def send_message(message: Dict[str, Any]) -> None:
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
                "tools": {},
                "readOnly": True
            },
            "serverInfo": {
                "name": "calculator-server",
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
                    "name": "add",
                    "description": "Add two numbers together",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "a": {
                                "type": "number",
                                "description": "First number"
                            },
                            "b": {
                                "type": "number",
                                "description": "Second number"
                            }
                        },
                        "required": ["a", "b"]
                    }
                },
                {
                    "name": "subtract",
                    "description": "Subtract second number from first number",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "a": {
                                "type": "number",
                                "description": "First number (minuend)"
                            },
                            "b": {
                                "type": "number",
                                "description": "Second number (subtrahend)"
                            }
                        },
                        "required": ["a", "b"]
                    }
                },
                {
                    "name": "multiply",
                    "description": "Multiply two numbers together",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "a": {
                                "type": "number",
                                "description": "First number"
                            },
                            "b": {
                                "type": "number",
                                "description": "Second number"
                            }
                        },
                        "required": ["a", "b"]
                    }
                },
                {
                    "name": "divide",
                    "description": "Divide first number by second number",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "a": {
                                "type": "number",
                                "description": "Dividend (number to be divided)"
                            },
                            "b": {
                                "type": "number",
                                "description": "Divisor (number to divide by)"
                            }
                        },
                        "required": ["a", "b"]
                    }
                },
                {
                    "name": "power",
                    "description": "Raise a number to a power (a^b)",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "base": {
                                "type": "number",
                                "description": "Base number"
                            },
                            "exponent": {
                                "type": "number",
                                "description": "Exponent (power)"
                            }
                        },
                        "required": ["base", "exponent"]
                    }
                },
                {
                    "name": "sqrt",
                    "description": "Calculate the square root of a number",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "value": {
                                "type": "number",
                                "description": "Number to calculate square root of"
                            }
                        },
                        "required": ["value"]
                    }
                },
                {
                    "name": "modulo",
                    "description": "Calculate the remainder of division (a % b)",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "a": {
                                "type": "number",
                                "description": "Dividend"
                            },
                            "b": {
                                "type": "number",
                                "description": "Divisor"
                            }
                        },
                        "required": ["a", "b"]
                    }
                },
                {
                    "name": "abs",
                    "description": "Calculate the absolute value of a number",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "value": {
                                "type": "number",
                                "description": "Number to calculate absolute value of"
                            }
                        },
                        "required": ["value"]
                    }
                }
            ]
        }
    })

def handle_call_tool(request_id: Any, params: Dict) -> None:
    """Handle tools/call request"""
    tool_name = params.get("name")
    arguments = params.get("arguments", {})
    
    try:
        result_text = ""
        
        if tool_name == "add":
            a = float(arguments.get("a", 0))
            b = float(arguments.get("b", 0))
            result = a + b
            result_text = f"## Addition Result\n\n**{a} + {b} = {result}**\n\n✓ Calculation completed successfully"
            
        elif tool_name == "subtract":
            a = float(arguments.get("a", 0))
            b = float(arguments.get("b", 0))
            result = a - b
            result_text = f"## Subtraction Result\n\n**{a} - {b} = {result}**\n\n✓ Calculation completed successfully"
            
        elif tool_name == "multiply":
            a = float(arguments.get("a", 0))
            b = float(arguments.get("b", 0))
            result = a * b
            result_text = f"## Multiplication Result\n\n**{a} × {b} = {result}**\n\n✓ Calculation completed successfully"
            
        elif tool_name == "divide":
            a = float(arguments.get("a", 0))
            b = float(arguments.get("b", 0))
            if b == 0:
                result_text = f"## Division Error\n\n❌ **Cannot divide by zero**\n\nAttempted: {a} ÷ 0"
            else:
                result = a / b
                result_text = f"## Division Result\n\n**{a} ÷ {b} = {result}**\n\n✓ Calculation completed successfully"
                
        elif tool_name == "power":
            base = float(arguments.get("base", 0))
            exponent = float(arguments.get("exponent", 0))
            result = math.pow(base, exponent)
            result_text = f"## Power Result\n\n**{base}^{exponent} = {result}**\n\n✓ Calculation completed successfully"
            
        elif tool_name == "sqrt":
            value = float(arguments.get("value", 0))
            if value < 0:
                result_text = f"## Square Root Error\n\n❌ **Cannot calculate square root of negative number**\n\nAttempted: √{value}"
            else:
                result = math.sqrt(value)
                result_text = f"## Square Root Result\n\n**√{value} = {result}**\n\n✓ Calculation completed successfully"
                
        elif tool_name == "modulo":
            a = float(arguments.get("a", 0))
            b = float(arguments.get("b", 0))
            if b == 0:
                result_text = f"## Modulo Error\n\n❌ **Cannot calculate modulo with divisor zero**\n\nAttempted: {a} % 0"
            else:
                result = a % b
                result_text = f"## Modulo Result\n\n**{a} % {b} = {result}**\n\n✓ Calculation completed successfully"
                
        elif tool_name == "abs":
            value = float(arguments.get("value", 0))
            result = abs(value)
            result_text = f"## Absolute Value Result\n\n**|{value}| = {result}**\n\n✓ Calculation completed successfully"
            
        else:
            send_message({
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {
                    "code": -32601,
                    "message": f"Unknown tool: {tool_name}"
                }
            })
            return
        
        send_message({
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": result_text
                    }
                ]
            }
        })
        
    except (ValueError, TypeError) as e:
        send_message({
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": -32602,
                "message": f"Invalid parameters: {str(e)}"
            }
        })
    except Exception as e:
        send_message({
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": -32603,
                "message": f"Internal error: {str(e)}"
            }
        })

def main():
    """Main server loop"""
    print("Calculator MCP Server started", file=sys.stderr)
    
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
                send_message({
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {method}"
                    }
                })
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}", file=sys.stderr)
        except Exception as e:
            print(f"Error processing request: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()

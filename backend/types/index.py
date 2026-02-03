from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from enum import Enum

class MCPServerType(str, Enum):
    STDIO = "stdio"

class MCPServerStatus(BaseModel):
    name: str
    connected: bool
    type: MCPServerType
    tool_count: int = 0
    read_only: bool = True
    error: Optional[str] = None

class ServerConfig(BaseModel):
    name: str
    command: str
    args: List[str]
    env: Dict[str, str] = {}
    read_only: bool = True

class ToolInfo(BaseModel):
    name: str
    description: str = ""
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    server_name: str

class ToolCallResult(BaseModel):
    response: str
    server: str
    tool: str
    steps: List[str] = Field(default_factory=list)

class ChatRequest(BaseModel):
    message: str
    request_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    server: str
    tool: str
    request_id: Optional[str] = None
    duration: Optional[float] = None

class ErrorResponse(BaseModel):
    error: str
    code: Optional[str] = None
    request_id: Optional[str] = None

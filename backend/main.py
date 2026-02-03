import os
import asyncio
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from uuid import uuid4
from datetime import datetime

from .mcp_manager import MCPManager
from .agent import AgentWrapper
from .utils.logger import logger, perf_monitor
from .types.index import ChatRequest, ChatResponse, ErrorResponse

app = FastAPI(title="MCP Agentic API", version="1.0.0")

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
mcp_manager = MCPManager()
agent = AgentWrapper(mcp_manager)
initialized = False

@app.on_event("startup")
async def startup_event():
    global initialized
    try:
        await mcp_manager.initialize_servers()
        initialized = True
        logger.info("Startup sequence initiated", {"component": "Server"})
    except Exception as e:
        logger.error("Failed during startup", {"component": "Server"}, error=e)

@app.middleware("http")
async def request_id_and_logging_middleware(request: Request, call_next):
    request_id = str(uuid4())
    request.state.request_id = request_id
    
    end_timer = perf_monitor.start_timer("http_request")
    
    logger.info("Incoming request", {
        "component": "Server",
        "method": request.method,
        "path": request.url.path,
        "request_id": request_id
    })
    
    response = await call_next(request)
    
    duration = end_timer()
    response.headers["X-Request-ID"] = request_id
    
    logger.info("Request completed", {
        "component": "Server",
        "method": request.method,
        "path": request.url.path,
        "status_code": response.status_code,
        "request_id": request_id,
        "duration": duration
    })
    
    return response

@app.get("/api/health")
async def health_check():
    status = mcp_manager.get_server_status()
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "services": {
            "backend": {"status": "up"},
            "mcp_servers": status
        }
    }

@app.get("/api/metrics")
async def get_metrics():
    return {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "metrics": perf_monitor.get_all_stats()
    }

@app.get("/api/logs")
async def get_logs(count: int = 100):
    logs = logger.get_recent_logs(count)
    return {
        "count": len(logs),
        "logs": logs
    }

@app.get("/api/servers")
async def get_servers():
    return mcp_manager.get_server_status()

@app.get("/api/tools")
async def get_tools():
    tools = await mcp_manager.list_all_tools()
    return tools

@app.post("/api/chat")
async def chat(request: ChatRequest, fastapi_request: Request):
    request_id = fastapi_request.state.request_id
    end_timer = perf_monitor.start_timer("chat_endpoint")
    
    try:
        logger.info("Processing agentic chat request", {
            "query": request.message,
            "request_id": request_id
        })
        
        # Guardrail: Limit message length
        if len(request.message) > 2000:
            raise HTTPException(status_code=400, detail="Message too long")

        # Agentic processing
        result = await agent.process_query(request.message, request_id)
        
        duration = end_timer()
        
        return ChatResponse(
            response=result["response"],
            server=result["server"],
            tool=result["tool"],
            request_id=request_id,
            duration=result["duration"]
        )

    except Exception as e:
        duration = end_timer()
        logger.error("Chat processing failed", {"request_id": request_id}, error=e)
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(error=str(e), request_id=request_id).model_dump()
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("BACKEND_PORT", 3001)))

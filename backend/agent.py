import os
from typing import Dict, Any
from openai import AsyncOpenAI
from agents import Agent, Runner, OpenAIChatCompletionsModel
from .mcp_manager import MCPManager
from .utils.logger import logger, perf_monitor

class AgentWrapper:
    def __init__(self, mcp_manager: MCPManager):
        self.mcp_manager = mcp_manager
        self.model_name = os.getenv("LLM_MODEL", "gpt-oss:latest")
        self.client = AsyncOpenAI(
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
            api_key="ollama", # dummy key
        )
        self.model = OpenAIChatCompletionsModel(
            model=self.model_name,
            openai_client=self.client
        )
        logger.info("AgentWrapper initialized with agents SDK", {"model": self.model_name})

    async def process_query(self, query: str, request_id: str) -> Dict[str, Any]:
        end_timer = perf_monitor.start_timer("agent_process_query")
        logger.info("Processing query using agents SDK", {"query": query, "request_id": request_id})

        instructions = """You are an agentic assistant that uses MCP tools.
        Process tools one by one as needed.
        When you have the final answer, format it in professional Markdown.
        Use headers, bold text, and lists for rich aesthetics."""

        # Get all servers from manager
        mcp_servers = self.mcp_manager.get_all_servers()

        agent = Agent(
            name="mcp_assistant",
            instructions=instructions,
            model=self.model,
            mcp_servers=mcp_servers
        )

        try:
            # Runner handles the tool-calling loop and MCP interaction automatically
            result = await Runner.run(agent, query)
            
            duration = end_timer()
            
            # The result.final_output contains the model's final response
            return {
                "response": result.final_output,
                "server": "mcp_orchestrator", 
                "tool": "automcp",
                "duration": duration
            }
        except Exception as e:
            logger.error("Error in agents SDK execution", {"request_id": request_id}, error=e)
            raise e


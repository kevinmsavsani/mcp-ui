import os
from typing import Dict, Any
from openai import AsyncOpenAI
from agents import Agent, Runner, OpenAIChatCompletionsModel
from .mcp_manager import MCPManager
from .utils.logger import logger, perf_monitor
from .specialists.confluence import get_confluence_specialist

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

        instructions = """You are an agentic assistant that uses MCP tools to help users.
        
        ### Specialized Workflow: Confluence Research
        Whenever a user asks for information from Confluence (e.g., "What is the status of X in Confluence?"):
        1. Always start by using `confluence_search` with a relevant CQL (e.g., `text ~ "your query"`).
        2. From the search results, identify the top 5 most relevant pages.
        3. For each of those 5 pages, use `confluence_get_page` to retrieve the full content.
        4. synthesize the content from all retrieved pages into a single, comprehensive Markdown response.
        5. Do not just report the titles; you must fetch the body and summarize it.

        ### General Rules:
        - Process tools one-by-one as needed to fulfill the request.
        - If a tool fails, inform the user why but try alternative parameters if possible.
        - Format the final output in professional, aesthetic Markdown with headers and lists.
        """

        # Get all servers from manager
        mcp_servers = self.mcp_manager.get_all_servers()

        # Create specialized researcher
        confluence_researcher = get_confluence_specialist(self.model)
        confluence_researcher.mcp_servers = mcp_servers

        agent = Agent(
            name="mcp_assistant",
            instructions=instructions,
            model=self.model,
            mcp_servers=mcp_servers,
            handoffs=[confluence_researcher]
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


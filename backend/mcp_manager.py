import os
from typing import Dict, List, Any
from agents.mcp import MCPServerStdio
from .utils.logger import logger

class MCPManager:
    def __init__(self):
        self.servers: Dict[str, MCPServerStdio] = {}
        self._setup_servers()
        logger.info("MCPManager initialized with agents SDK", {"component": "MCPManager"})

    def _setup_servers(self):
        # Calculator Server
        self.servers["calculator"] = MCPServerStdio(
            command="python3",
            args=[os.getenv("CALCULATOR_SERVER_PATH", "./mcp-servers/calculator-server.py")]
        )

        # GitHub Server
        self.servers["github"] = MCPServerStdio(
            command="docker",
            args=[
                "run", "-i", "--rm",
                "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
                "-e", "GITHUB_HOST",
                "ghcr.io/github/github-mcp-server"
            ],
            env={
                "GITHUB_PERSONAL_ACCESS_TOKEN": os.getenv("GITHUB_PERSONAL_ACCESS_TOKEN", ""),
                "GITHUB_HOST": os.getenv("GITHUB_HOST", "https://github.com")
            }
        )

        # Atlassian Server
        self.servers["atlassian"] = MCPServerStdio(
            command="docker",
            args=[
                "run", "-i", "--rm",
                "-e", "CONFLUENCE_URL",
                "-e", "CONFLUENCE_USERNAME",
                "-e", "CONFLUENCE_API_TOKEN",
                "-e", "JIRA_URL",
                "-e", "JIRA_USERNAME",
                "-e", "JIRA_API_TOKEN",
                "ghcr.io/sooperset/mcp-atlassian:latest"
            ],
            env={
                "CONFLUENCE_URL": os.getenv("CONFLUENCE_URL", ""),
                "CONFLUENCE_USERNAME": os.getenv("CONFLUENCE_USERNAME", ""),
                "CONFLUENCE_API_TOKEN": os.getenv("CONFLUENCE_API_TOKEN", ""),
                "JIRA_URL": os.getenv("JIRA_URL", ""),
                "JIRA_USERNAME": os.getenv("JIRA_USERNAME", ""),
                "JIRA_API_TOKEN": os.getenv("JIRA_API_TOKEN", "")
            }
        )

    def get_all_servers(self) -> List[MCPServerStdio]:
        return list(self.servers.values())

    async def list_all_tools(self) -> List[Any]:
        # The agents SDK handles tool discovery internally.
        # This is a simplified placeholder to keep the UI from breaking.
        return [{"name": f"tools_from_{name}", "server": name} for name in self.servers]

    def get_server_status(self) -> Dict[str, Any]:
        return {name: {"name": name, "connected": True} for name in self.servers}

    async def initialize_servers(self):
        logger.info("MCP servers ready for dynamic connection", {"component": "MCPManager"})


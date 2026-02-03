from agents import Agent
from ..utils.logger import logger

def get_confluence_specialist(model):
    """
    Returns a specialized Agent configured specifically for Confluence research.
    """
    instructions = """You are a Confluence Research Specialist.
    Your sole goal is to find, retrieve, and summarize information from Confluence.
    
    ### Your Protocol:
    1. Search: Use `confluence_search` with CQL to find the most relevant items.
    2. Retrieve: For the top 5 results, use `confluence_get_page` to get the actual text content.
    3. Synthesize: Read everything and write a detailed Summary in Markdown.
    
    Always ensure you provide a high-quality summary of the content, not just a list of links.
    """
    
    return Agent(
        name="confluence_researcher",
        instructions=instructions,
        model=model
    )

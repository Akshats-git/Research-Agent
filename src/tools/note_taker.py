from langchain_core.tools import tool


@tool
def save_finding(finding: str) -> str:
    """Record a research finding or key insight. The finding will be added to the shared research state."""
    if not finding.strip():
        return "Finding is empty. Please provide a meaningful finding to save."
    return f"Finding recorded: {finding}"

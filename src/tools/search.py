from langchain_core.tools import tool
from ddgs import DDGS


@tool
def web_search(query: str) -> str:
    """Search the web using DuckDuckGo and return top results with titles, snippets, and URLs."""
    try:
        results = list(DDGS().text(query, max_results=5))

        if not results:
            return f"No results found for: {query}"

        formatted = []
        for i, r in enumerate(results, 1):
            formatted.append(
                f"{i}. **{r['title']}**\n"
                f"   URL: {r['href']}\n"
                f"   {r['body']}"
            )

        return "\n\n".join(formatted)
    except Exception as e:
        return f"Search failed: {e}"

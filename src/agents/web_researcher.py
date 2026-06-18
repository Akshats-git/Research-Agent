from langchain_core.messages import SystemMessage, HumanMessage

from src.config import get_llm
from src.state import ResearchState
from src.tools.search import web_search

WEB_RESEARCHER_PROMPT = """You are a web research specialist. Your job is to search the web and gather factual, relevant information for a research query.

## Instructions
1. Based on the research plan and query, perform targeted web searches.
2. You may call the web_search tool MULTIPLE times with different queries to get comprehensive results.
3. For each search, evaluate the results critically — look for credible sources and consistent information.
4. After searching, compile your findings into a clear summary that includes:
   - Key facts discovered
   - Source attribution (which URLs provided which information)
   - Any conflicting information between sources
   - Confidence level (high/medium/low) for each finding

Be thorough but focused. Don't search for things unrelated to the research plan."""


def web_researcher_node(state: ResearchState) -> dict:
    llm = get_llm().bind_tools([web_search])

    messages = [
        SystemMessage(content=WEB_RESEARCHER_PROMPT),
        HumanMessage(content=(
            f"Research query: {state['query']}\n\n"
            f"Research plan: {state.get('plan', 'No plan yet — research the query broadly.')}\n\n"
            f"Previous web findings: {len(state.get('web_findings', []))} items already collected.\n"
            "Search the web and gather new findings."
        )),
    ]

    findings = []
    max_tool_calls = 3

    for _ in range(max_tool_calls):
        response = llm.invoke(messages)
        messages.append(response)

        if not response.tool_calls:
            break

        for tool_call in response.tool_calls:
            result = web_search.invoke(tool_call["args"])
            from langchain_core.messages import ToolMessage
            messages.append(ToolMessage(content=result, tool_call_id=tool_call["id"]))

    final_response = llm.invoke(messages + [
        HumanMessage(content="Now compile all search results into a clear summary of your findings. Include source URLs.")
    ])

    findings.append(final_response.content)

    return {
        "web_findings": findings,
        "current_agent": "orchestrator",
        "messages": [{"role": "web_researcher", "content": f"Gathered {len(findings)} finding(s)"}],
    }

"""Web researcher agent: runs web searches and summarises what it finds."""

from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage

from research_assistant.config import get_llm, message_text
from research_assistant.state import ResearchState
from research_assistant.tools.search import web_search

# Cap on search rounds so a single research step can't run away.
MAX_SEARCHES = 3

WEB_RESEARCHER_PROMPT = """You are a web research specialist. Your job is to search the web and gather factual, relevant information for a research query.

## Instructions
1. Based on the research plan and query, perform targeted web searches.
2. You may call the web_search tool MULTIPLE times with different queries to get comprehensive results.
3. For each search, evaluate the results critically. Look for credible sources and consistent information.
4. After searching, compile your findings into a clear summary that includes:
   - Key facts discovered
   - Source attribution (which URLs provided which information)
   - Any conflicting information between sources
   - Confidence level (high/medium/low) for each finding

Be thorough but focused. Don't search for things unrelated to the research plan."""

SUMMARY_REQUEST = (
    "Now compile all search results into a clear summary of your findings. Include source URLs."
)


def web_researcher_node(state: ResearchState) -> dict:
    llm = get_llm()
    searcher = llm.bind_tools([web_search])
    # Same model and history, but barred from searching again, for the write-up.
    summariser = llm.bind_tools([web_search], tool_choice="none")

    messages = [
        SystemMessage(content=WEB_RESEARCHER_PROMPT),
        HumanMessage(content=(
            f"Research query: {state['query']}\n\n"
            f"Research plan: {state.get('plan') or 'No plan yet. Research the query broadly.'}\n\n"
            f"Previous web findings: {len(state.get('web_findings', []))} item(s) already collected.\n"
            "Search the web and gather new findings."
        )),
    ]

    # Let the model drive the search loop: it decides each query and when to stop.
    for _ in range(MAX_SEARCHES):
        response = searcher.invoke(messages)
        messages.append(response)

        if not response.tool_calls:
            break

        for call in response.tool_calls:
            result = web_search.invoke(call["args"])
            messages.append(ToolMessage(content=result, tool_call_id=call["id"]))

    # Without tool_choice="none" the model can answer this with yet another search
    # call instead of prose, which would record an empty finding.
    summary = summariser.invoke(messages + [HumanMessage(content=SUMMARY_REQUEST)])

    return {
        "web_findings": [message_text(summary)],
        "current_agent": "orchestrator",
        "messages": [{"role": "web_researcher", "content": "Gathered web findings"}],
    }

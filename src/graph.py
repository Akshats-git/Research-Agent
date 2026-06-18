from langgraph.graph import StateGraph, END

from src.state import ResearchState
from src.agents.orchestrator import orchestrator_node
from src.agents.web_researcher import web_researcher_node
from src.agents.document_analyst import document_analyst_node
from src.agents.synthesizer import synthesizer_node


def route_after_orchestrator(state: ResearchState) -> str:
    agent = state.get("current_agent", "synthesizer")
    if agent in ("web_researcher", "document_analyst", "synthesizer"):
        return agent
    return "synthesizer"


def route_after_research(state: ResearchState) -> str:
    return "orchestrator"


def build_graph():
    graph = StateGraph(ResearchState)

    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("web_researcher", web_researcher_node)
    graph.add_node("document_analyst", document_analyst_node)
    graph.add_node("synthesizer", synthesizer_node)

    graph.set_entry_point("orchestrator")

    graph.add_conditional_edges(
        "orchestrator",
        route_after_orchestrator,
        {
            "web_researcher": "web_researcher",
            "document_analyst": "document_analyst",
            "synthesizer": "synthesizer",
        },
    )

    graph.add_edge("web_researcher", "orchestrator")
    graph.add_edge("document_analyst", "orchestrator")
    graph.add_edge("synthesizer", END)

    return graph.compile()

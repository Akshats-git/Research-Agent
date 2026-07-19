from typing import Annotated
from operator import add
from typing_extensions import TypedDict


class ResearchState(TypedDict):
    """Shared state passed between every node in the research graph.

    Fields annotated with ``add`` are *accumulated* across nodes — LangGraph
    appends each node's contribution instead of overwriting — so findings and
    messages build up over the course of a run. The plain fields are simply
    replaced by whichever node writes them last.
    """

    query: str                                # The user's research question.
    plan: str                                 # Orchestrator's current research plan.
    reasoning: str                            # Why the orchestrator picked the next agent.
    web_findings: Annotated[list[str], add]   # Summaries produced by the web researcher.
    doc_findings: Annotated[list[str], add]   # Summaries produced by the document analyst.
    documents: list[str]                      # Paths of user-uploaded files to analyse.
    final_report: str                         # The synthesizer's finished report.
    current_agent: str                        # Node the orchestrator routes to next.
    messages: Annotated[list, add]            # Running log of per-agent activity.
    iteration: int                            # Orchestrator loop counter (capped by MAX_ITERATIONS).

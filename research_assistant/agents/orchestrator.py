"""Orchestrator agent: plans the research and routes to the right specialist."""

from typing import Literal

from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage

from research_assistant.config import get_llm, MAX_ITERATIONS
from research_assistant.state import ResearchState

Specialist = Literal["web_researcher", "document_analyst", "synthesizer"]


class ResearchPlan(BaseModel):
    """Structured routing decision. The orchestrator never replies in free text."""

    plan: str = Field(description="A concise research plan outlining what to investigate")
    next_agent: Specialist = Field(description="The agent that should run next")
    reasoning: str = Field(description="Why this agent should run next")


ORCHESTRATOR_PROMPT = """You are a research orchestrator. Your job is to coordinate a team of specialist agents to answer a research query.

You have these specialist agents available:
- **web_researcher**: Searches the web via DuckDuckGo. Use for current events, general knowledge, or any topic needing online sources.
- **document_analyst**: Reads and analyzes user-provided documents (PDFs, text files). Only use if the user has provided documents.
- **synthesizer**: Combines all gathered findings into a final structured report. Call this when you have enough findings OR when max iterations are reached.

## Rules
1. On the FIRST call, create a research plan and decide which agent should go first.
2. On SUBSEQUENT calls, review what findings have been gathered so far and decide the next step.
3. If no documents were provided by the user, NEVER call document_analyst.
4. Call the synthesizer when:
   - You have sufficient findings from web research (and document analysis if applicable)
   - OR the iteration limit is approaching
5. Be efficient. Don't repeat searches that have already been done."""


def _build_context(state: ResearchState, iteration: int) -> str:
    """Assemble everything the orchestrator needs to make its next decision."""
    web_findings = state.get("web_findings", [])
    doc_findings = state.get("doc_findings", [])

    parts = [f"Research query: {state['query']}"]
    if state.get("plan"):
        parts.append(f"Current plan: {state['plan']}")
    if web_findings:
        parts.append(
            f"Web findings so far ({len(web_findings)} items):\n" + "\n---\n".join(web_findings)
        )
    if doc_findings:
        parts.append(
            f"Document findings so far ({len(doc_findings)} items):\n" + "\n---\n".join(doc_findings)
        )
    parts.append(
        f"User provided documents: {state['documents']}"
        if state.get("documents")
        else "No documents provided by user."
    )
    parts.append(f"Current iteration: {iteration + 1}/{MAX_ITERATIONS}")
    return "\n\n".join(parts)


def orchestrator_node(state: ResearchState) -> dict:
    iteration = state.get("iteration", 0)

    # Hard stop: once we've looped enough, synthesize with whatever we have.
    if iteration >= MAX_ITERATIONS:
        return {"current_agent": "synthesizer", "iteration": iteration}

    llm = get_llm().with_structured_output(ResearchPlan)
    result = llm.invoke([
        SystemMessage(content=ORCHESTRATOR_PROMPT),
        HumanMessage(content=_build_context(state, iteration)),
    ])

    # Guard against the model routing to the analyst when there's nothing to analyse.
    next_agent = result.next_agent
    if next_agent == "document_analyst" and not state.get("documents"):
        next_agent = "synthesizer" if state.get("web_findings") else "web_researcher"

    return {
        "plan": result.plan,
        "current_agent": next_agent,
        "reasoning": result.reasoning,
        "iteration": iteration + 1,
        "messages": [{"role": "orchestrator", "content": f"Plan: {result.plan} | Next: {next_agent}"}],
    }

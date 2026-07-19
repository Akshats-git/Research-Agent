"""Orchestrator agent: plans the research and routes to the right specialist."""

from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage

from src.config import get_llm, MAX_ITERATIONS
from src.state import ResearchState


class ResearchPlan(BaseModel):
    """Structured routing decision — the orchestrator never replies in free text."""

    plan: str = Field(description="A concise research plan outlining what to investigate")
    next_agent: str = Field(
        description="The next agent to call: 'web_researcher', 'document_analyst', or 'synthesizer'"
    )
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
5. Be efficient — don't repeat searches that have already been done."""


def orchestrator_node(state: ResearchState) -> dict:
    iteration = state.get("iteration", 0)
    has_documents = bool(state.get("documents"))
    web_findings = state.get("web_findings", [])
    doc_findings = state.get("doc_findings", [])

    # Hard stop: once we've looped enough, synthesize with whatever we have.
    if iteration >= MAX_ITERATIONS:
        return {"current_agent": "synthesizer", "iteration": iteration}

    # Assemble everything the orchestrator needs to make its next decision.
    context = [f"Research query: {state['query']}"]
    if state.get("plan"):
        context.append(f"Current plan: {state['plan']}")
    if web_findings:
        context.append(f"Web findings so far ({len(web_findings)} items):\n" + "\n---\n".join(web_findings))
    if doc_findings:
        context.append(f"Document findings so far ({len(doc_findings)} items):\n" + "\n---\n".join(doc_findings))
    context.append(
        f"User provided documents: {state['documents']}" if has_documents
        else "No documents provided by user."
    )
    context.append(f"Current iteration: {iteration + 1}/{MAX_ITERATIONS}")

    llm = get_llm().with_structured_output(ResearchPlan)
    result = llm.invoke([
        SystemMessage(content=ORCHESTRATOR_PROMPT),
        HumanMessage(content="\n\n".join(context)),
    ])

    # Guard against the model routing to the analyst when there's nothing to analyse.
    next_agent = result.next_agent
    if not has_documents and next_agent == "document_analyst":
        next_agent = "web_researcher" if not web_findings else "synthesizer"

    return {
        "plan": result.plan,
        "current_agent": next_agent,
        "reasoning": result.reasoning,
        "iteration": iteration + 1,
        "messages": [{"role": "orchestrator", "content": f"Plan: {result.plan} | Next: {next_agent}"}],
    }

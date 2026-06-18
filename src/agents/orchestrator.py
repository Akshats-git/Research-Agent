from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage

from src.config import get_llm, MAX_ITERATIONS
from src.state import ResearchState


class ResearchPlan(BaseModel):
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
    llm = get_llm().with_structured_output(ResearchPlan)
    iteration = state.get("iteration", 0)
    has_documents = bool(state.get("documents"))
    web_findings = state.get("web_findings", [])
    doc_findings = state.get("doc_findings", [])

    if iteration >= MAX_ITERATIONS:
        return {"current_agent": "synthesizer", "iteration": iteration}

    context_parts = [f"Research query: {state['query']}"]

    if state.get("plan"):
        context_parts.append(f"Current plan: {state['plan']}")

    if web_findings:
        context_parts.append(f"Web findings so far ({len(web_findings)} items):\n" + "\n---\n".join(web_findings))

    if doc_findings:
        context_parts.append(f"Document findings so far ({len(doc_findings)} items):\n" + "\n---\n".join(doc_findings))

    if has_documents:
        context_parts.append(f"User provided documents: {state['documents']}")
    else:
        context_parts.append("No documents provided by user.")

    context_parts.append(f"Current iteration: {iteration + 1}/{MAX_ITERATIONS}")

    messages = [
        SystemMessage(content=ORCHESTRATOR_PROMPT),
        HumanMessage(content="\n\n".join(context_parts)),
    ]

    result = llm.invoke(messages)

    if not has_documents and result.next_agent == "document_analyst":
        result.next_agent = "web_researcher" if not web_findings else "synthesizer"

    return {
        "plan": result.plan,
        "current_agent": result.next_agent,
        "reasoning": result.reasoning,
        "iteration": iteration + 1,
        "messages": [{"role": "orchestrator", "content": f"Plan: {result.plan} | Next: {result.next_agent}"}],
    }

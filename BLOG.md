# Building a Multi-Agent Research Assistant: The Full Story

## Why This Project?

The AI landscape has moved beyond single-prompt, single-response chatbots. The real power lies in **agents that collaborate** — each with a specialized role, working together to solve problems no single agent could handle well alone.

I wanted to build something that demonstrates this shift: a system where multiple AI agents coordinate to research any topic, combining web search, document analysis, and synthesis into a structured report. Not a toy demo, but something with real architectural decisions — state management, agent routing, iteration control, and a clean CLI interface.

The result: a **Multi-Agent Research Assistant** built with LangGraph and LangChain.

---

## The Architecture Decision: Why LangGraph + LangChain?

The first question was: *how do we make agents collaborate?*

**LangChain** is great for building individual agents — it gives you LLM wrappers, tool integrations, prompt templates, and document loaders. But it doesn't natively solve the *coordination* problem: how does one agent hand off to another? How do they share findings? How do we prevent infinite loops?

That's where **LangGraph** comes in. It provides a **stateful graph** where:
- Each agent is a **node**
- Transitions between agents are **edges** (with conditional routing)
- All agents read from and write to a **shared state**
- The graph has built-in support for cycles with termination conditions

So the split is clean:
- **LangGraph** = the orchestra (coordination, routing, state)
- **LangChain** = the instruments (LLMs, tools, loaders inside each agent)

### The Agent Lineup

| Agent | Role | Tools |
|-------|------|-------|
| **Orchestrator** | Receives the query, creates a research plan, decides which agents to call, re-evaluates after each step | Structured output (Pydantic) |
| **Web Researcher** | Searches the web via DuckDuckGo, cross-references results, records findings | DuckDuckGo search |
| **Document Analyst** | Loads and analyzes user-provided PDFs/text files, extracts relevant info | PDF/text loader |
| **Synthesizer** | Combines all findings into a structured final report | None (pure LLM reasoning) |

---

## Phase 1: Laying the Foundation

### Project Structure

We went with a clean `src/` layout separating concerns:

```
multi-agent-research-assistant/
├── pyproject.toml          # Dependencies & project config
├── .env.example            # API key template
├── src/
│   ├── config.py           # LLM initialization & settings
│   ├── state.py            # Shared graph state (TypedDict)
│   ├── agents/             # One file per agent
│   ├── tools/              # Search, doc loader, note taker
│   └── utils/              # CLI output helpers
```

### The Shared State — The Backbone

The most critical design decision early on was the **shared state**. In LangGraph, all nodes communicate through a single `TypedDict`. Here's what we defined:

```python
class ResearchState(TypedDict):
    query: str                              # What the user asked
    plan: str                               # Orchestrator's research plan
    web_findings: Annotated[list[str], add]  # Accumulated web results
    doc_findings: Annotated[list[str], add]  # Accumulated document results
    documents: list[str]                     # File paths from user
    final_report: str                        # The synthesized output
    current_agent: str                       # Routing tracker
    messages: Annotated[list, add]           # Conversation history
    iteration: int                           # Loop counter (max 3)
```

The `Annotated[list[str], add]` pattern is key — it tells LangGraph to **append** new findings to the existing list rather than overwrite. This way, each agent adds to the collective knowledge without clobbering what came before.

### Config: Fail Fast

`config.py` loads the OpenAI API key from `.env` and exits immediately with a clear error if it's missing. No cryptic stack traces halfway through a research run — just a clear message telling you what to do. The LLM is initialized lazily via a `get_llm()` function so imports stay fast.

### What's Next

With the foundation in place — project structure, dependency management, shared state, and config — we're ready to build the **tools layer** in Phase 2: DuckDuckGo search, document loading, and the note-taking mechanism that lets agents record their findings.

---

*Phase 2 coming up: Building the tools...*

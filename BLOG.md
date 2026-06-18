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

## Phase 2: Building the Tools

Tools are how agents interact with the outside world. Without tools, an LLM can only reason — it can't *do* anything. We needed three:

### 1. Web Search (`tools/search.py`)

We wrapped DuckDuckGo as a LangChain tool using the `@tool` decorator. The function takes a query string, hits DuckDuckGo, and returns the top 5 results formatted with title, URL, and snippet.

```python
@tool
def web_search(query: str) -> str:
    """Search the web using DuckDuckGo and return top results."""
    results = list(DDGS().text(query, max_results=5))
    # ... format and return
```

**Challenge encountered:** The original `duckduckgo-search` package has been renamed to `ddgs`. Our first test returned zero results with a deprecation warning. We caught this during testing and switched to the new `ddgs` package — a good reminder to always test tools in isolation before wiring them into agents.

### 2. Document Loader (`tools/doc_loader.py`)

This tool handles PDF and text files. It uses `pypdf` for PDFs and plain file reads for `.txt`, `.md`, and `.csv` files. After loading, it chunks the content using LangChain's `RecursiveCharacterTextSplitter` (2000 chars per chunk, 200 overlap) so large documents don't overwhelm the LLM's context window.

The tool validates file existence and type before processing, returning clear error messages for missing files or unsupported formats.

### 3. Note Taker (`tools/note_taker.py`)

This is the simplest but most architecturally interesting tool. It's intentionally **stateless** — it just validates and echoes the finding back. The actual state update (appending to `web_findings` or `doc_findings`) is handled by the agent node function in LangGraph.

Why this design? LangChain tools shouldn't know about LangGraph state. Keeping tools as pure functions and letting the graph layer manage state gives us clean separation. The tool is the LLM's way of saying "I found something important" — the node function is what actually records it.

### Design Principle: Tools are Stateless, Nodes Manage State

This is a key architectural decision. In LangGraph:
- **Tools** = pure functions the LLM can call (search, load, validate)
- **Nodes** = graph functions that run tools, interpret results, and update shared state

This keeps the codebase testable (tools can be tested in isolation) and flexible (same tools can be reused across different agents).

### What's Next

With the tools built and tested, we're ready for the most exciting phase — **building the agents** in Phase 3. Each agent will get a system prompt, a set of tools, and a node function that wires it into the LangGraph state.

---

*Phase 3 coming up: Building the agents...*

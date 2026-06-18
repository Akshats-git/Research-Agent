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

## Phase 3: Building the Agents

This is where the project comes alive. Each agent is a Python function (a LangGraph "node") that receives the shared state, does its work, and returns state updates.

### The Orchestrator — The Brain

The orchestrator is the decision-maker. It doesn't do research itself — it creates a plan and decides which specialist to call next.

**Key design choice: Structured output.** Instead of parsing free-text responses, the orchestrator uses Pydantic models with LangChain's `with_structured_output()`:

```python
class ResearchPlan(BaseModel):
    plan: str         # What to investigate
    next_agent: str   # 'web_researcher', 'document_analyst', or 'synthesizer'
    reasoning: str    # Why this agent should go next
```

This guarantees the orchestrator always returns valid routing decisions — no regex parsing, no "I hope the LLM formats it correctly." The LLM is constrained to output exactly these fields, and LangGraph uses `next_agent` to route to the correct node.

**Safety rails:** If the iteration counter hits the max (3), the orchestrator skips LLM reasoning entirely and routes straight to the synthesizer. And if there are no user-provided documents, it hard-blocks any attempt to route to the document analyst — even if the LLM hallucinates that choice.

### The Web Researcher — The Investigator

This agent gets the query and plan, then performs multiple DuckDuckGo searches using the tool-calling loop pattern:

```
LLM decides search query → calls web_search tool → gets results → decides next search → ... → compiles summary
```

The agent uses LangChain's `.bind_tools()` to give the LLM access to the `web_search` tool. It loops up to 3 tool calls, letting the LLM decide what to search for and when it has enough information. After all searches, it asks the LLM for a compiled summary with source URLs.

The findings are returned as a list that LangGraph **appends** to `web_findings` (thanks to the `Annotated[list[str], add]` pattern in our state definition).

### The Document Analyst — The Reader

Structurally similar to the web researcher, but uses the `load_document` tool instead. It iterates through user-provided file paths, loads each one, and analyzes the content in context of the research query.

**Edge case handled:** If called with no documents (which shouldn't happen thanks to the orchestrator's guard, but defense in depth), it returns a clean message and routes back to the orchestrator instead of crashing.

### The Synthesizer — The Writer

The synthesizer is the only agent with **no tools** — it's pure LLM reasoning. It takes all `web_findings` and `doc_findings` from the shared state and produces a structured report with:

- **Executive Summary** — 2-3 paragraph overview
- **Key Findings** — numbered, with source attribution and confidence levels
- **Conflicting Information** — contradictions between sources
- **Knowledge Gaps** — what's still unknown
- **Recommendations** — actionable next steps

The prompt template enforces this structure, so the output is consistent across different research queries.

### Pattern: The Tool-Calling Loop

Both the web researcher and document analyst use the same pattern:

```python
for _ in range(max_tool_calls):
    response = llm.invoke(messages)       # LLM decides what to do
    messages.append(response)
    if not response.tool_calls:           # No more tools needed? Done.
        break
    for tool_call in response.tool_calls: # Execute each tool call
        result = tool.invoke(tool_call["args"])
        messages.append(ToolMessage(...)) # Feed result back to LLM
```

This is a manual agent loop — we control exactly how many tool calls are allowed, and the LLM decides when to stop. This gives us more control than `AgentExecutor` while keeping the code transparent.

### What's Next

All four agents are built, tested, and ready. Phase 4 will wire them together into a LangGraph workflow and build the CLI — that's when we'll see the full system run end-to-end.

---

## Phase 4: Wiring the Graph and Building the CLI

This is the phase where isolated pieces become a working system.

### The LangGraph Workflow (`graph.py`)

The graph has a simple but powerful structure:

```
Entry → Orchestrator → [conditional routing]
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
      Web Researcher  Doc Analyst    Synthesizer → END
            │              │
            └──────┬───────┘
                   ▼
             Orchestrator (re-evaluate)
```

In code, this is built with LangGraph's `StateGraph`:

```python
graph = StateGraph(ResearchState)
graph.add_node("orchestrator", orchestrator_node)
graph.add_node("web_researcher", web_researcher_node)
graph.add_node("document_analyst", document_analyst_node)
graph.add_node("synthesizer", synthesizer_node)

graph.set_entry_point("orchestrator")
graph.add_conditional_edges("orchestrator", route_after_orchestrator, {...})
graph.add_edge("web_researcher", "orchestrator")
graph.add_edge("document_analyst", "orchestrator")
graph.add_edge("synthesizer", END)
```

**The key insight:** After the web researcher or document analyst finishes, they always route back to the orchestrator — not to each other, not to the synthesizer. The orchestrator re-evaluates the state of knowledge and decides what's next. This creates a natural loop: plan → research → re-evaluate → more research or synthesize.

**Routing safety:** The `route_after_orchestrator` function validates the agent name. If the orchestrator returns an unexpected value (LLM hallucination), it falls back to the synthesizer — ensuring the graph always terminates rather than crashing.

### The CLI (`main.py`)

We built two modes:
1. **Argument mode**: `python -m src.main "your query here"` — single-shot research
2. **Interactive mode**: `python -m src.main` — REPL loop where you can run multiple queries

The CLI uses `graph.stream()` instead of `graph.invoke()`. Streaming gives us step-by-step visibility — we see which node is running as it happens, rather than waiting in silence for the full run to complete. Each step updates a Rich spinner and prints which agent just acted and what it found.

### Rich Output (`utils/output.py`)

Each agent gets a color-coded label:
- 🔵 **Orchestrator** — cyan
- 🟢 **Web Researcher** — green
- 🟡 **Document Analyst** — yellow
- 🟣 **Synthesizer** — magenta

The final report is rendered inside a Rich `Panel` with full Markdown formatting — headers, bullet points, bold text all render cleanly in the terminal.

### First Live Run

The moment of truth — running the full system on a real query:

```
python -m src.main "What are the latest advances in quantum computing?"
```

The orchestrator created a plan, routed to the web researcher twice (it decided one round wasn't enough), then routed to the synthesizer. The final report came back with 10 key findings, source attribution, confidence levels, knowledge gaps, and recommendations — all rendered in a Rich panel with Markdown formatting.

It worked on the first try. That's rare, and it's a testament to testing each layer in isolation before wiring them together.

---

## Phase 5: Polish and Reflection

### The README

A project isn't complete without documentation that lets someone else (or future-you) pick it up and run with it. The README covers:

- ASCII architecture diagram showing the agent flow
- Agent roles table
- Step-by-step setup instructions
- Usage examples for all three modes (argument, document, interactive)
- Project structure map
- Key design decisions with rationale

### Challenges We Hit Along the Way

**1. The DuckDuckGo rename.** The `duckduckgo-search` package was renamed to `ddgs`. The old one imported fine but silently returned empty results. We only caught this because we tested tools in isolation before integrating them — a good argument for bottom-up testing.

**2. The config fail-fast.** `config.py` exits on import if `OPENAI_API_KEY` is missing. This is the right behavior at runtime, but it blocks import-level tests. We solved this by using a dummy env var (`OPENAI_API_KEY=test-key`) for structural tests. The lesson: fail-fast is great for users, but your test harness needs a way around it.

**3. Routing hallucinations.** LLMs can return unexpected values even with structured output. The `route_after_orchestrator` function falls back to the synthesizer for any unrecognized agent name, ensuring the graph always terminates cleanly.

**4. State append semantics.** Without `Annotated[list[str], add]`, each agent would overwrite the findings list instead of appending to it. This single annotation is what makes the collaborative accumulation of knowledge work — it's easy to miss but critical.

### What I Learned

1. **LangGraph and LangChain serve different purposes.** LangGraph is for orchestration (the graph, routing, state). LangChain is for the building blocks inside each agent (LLMs, tools, loaders). Trying to use one for the other's job leads to pain.

2. **Structured output > free-text parsing.** Using Pydantic models for the orchestrator's decisions eliminated an entire class of bugs (malformed routing, missing fields, type mismatches).

3. **Test each layer in isolation.** Tools → agents → graph → CLI. Each layer was verified before the next was built. This caught the DuckDuckGo rename at the tool level instead of during a confusing end-to-end failure.

4. **Stateless tools, stateful nodes.** Keeping tools as pure functions and letting LangGraph nodes manage state keeps the architecture clean and testable.

5. **Streaming beats invoke.** Using `graph.stream()` gives real-time visibility into which agent is running. `graph.invoke()` would leave the user staring at a blank terminal for 30+ seconds.

---

## Phase 6: From CLI to Full-Stack — Adding a Web Frontend

The CLI worked great for development and testing, but a beautiful web frontend makes the project shine.

### The Stack Choice: Next.js + FastAPI

We went with **Next.js** (React, TypeScript, Tailwind CSS) for the frontend and **FastAPI** for the backend API. The split is intentional:

- **FastAPI** is a thin layer over the existing graph — it doesn't duplicate any logic. It just exposes `graph.stream()` as a Server-Sent Events (SSE) endpoint.
- **Next.js** provides the UI with server components, fast HMR, and Tailwind for styling.

### Server-Sent Events (SSE) for Real-Time Updates

The key technical decision was how to stream agent updates to the browser. Options:
- **WebSockets** — bidirectional, but overkill (we only need server → client)
- **Polling** — simple but laggy, no real-time feel
- **SSE** — server → client streaming over HTTP, native browser support via `EventSource`

SSE was the perfect fit. The backend wraps each `graph.stream()` step as an SSE event:

```python
async def _stream_research(query, documents):
    for step in graph.stream(initial_state):
        for node_name, node_state in step.items():
            yield f"event: agent_update\ndata: {json.dumps(event_data)}\n\n"
```

The frontend reads these events with `fetch()` + `ReadableStream`, updating the UI as each agent completes its work. The user sees orchestrator routing, web researcher searching, and the synthesizer generating — all in real time.

### The Frontend Design

We went for a dark-themed, minimal design:
- **Empty state** with suggestion chips — one click fills the query
- **Step cards** that appear as each agent runs, with color-coded labels and animated indicators
- **Markdown report** rendered in a styled panel when the synthesizer finishes
- **File upload** for document analysis
- **Sticky input bar** at the bottom, chat-app style

Each agent gets a visual identity:
- 🧠 Orchestrator (cyan)
- 🔍 Web Researcher (emerald)
- 📄 Document Analyst (amber)
- ✨ Synthesizer (violet)

### Challenge: SSE Parsing in the Browser

The native `EventSource` API doesn't support POST requests or custom headers. Since our research endpoint needs a `FormData` POST (for file uploads), we had to use `fetch()` with a manual SSE parser — reading the response stream chunk by chunk, splitting on `\n\n`, and parsing `event:` / `data:` lines ourselves. More code, but full control.

### The Final Architecture

```
User → Browser (Next.js on :3000)
         → POST /api/research (FastAPI on :8000)
              → LangGraph (graph.py)
                   → Orchestrator (plan + route)
                        → Web Researcher (search + findings)
                        → Document Analyst (load + analyze)
                        → back to Orchestrator (re-evaluate)
                   → Synthesizer (compile report)
              → SSE stream back to browser
         → Rendered Markdown report
```

Four agents. Three tools. One shared state. SSE streaming from backend to frontend. A clean loop with termination guarantees. And a polished web UI that shows you what's happening every step of the way.

---

*Built with LangGraph + LangChain + FastAPI + Next.js + GPT-4o + a lot of deliberate architecture decisions.*

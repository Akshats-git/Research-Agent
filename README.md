# Multi-Agent Research Assistant

A multi-agent system where specialized AI agents collaborate to research any topic — searching the web, analyzing documents, and synthesizing findings into a structured report.

Built with **LangGraph** for agent orchestration, **LangChain** for LLM tooling, **FastAPI** for the backend, and **Next.js** for the frontend.

## Architecture

```
User Query (Browser)
      │
      ▼
┌─────────────┐     SSE Stream      ┌──────────────┐
│  Next.js    │ ◄──────────────────► │   FastAPI    │
│  Frontend   │                      │   Backend    │
└─────────────┘                      └──────┬───────┘
                                            │
                                     ┌──────▼──────┐
                                     │ ORCHESTRATOR │
                                     └──────┬──────┘
                                            │ conditional routing
                              ┌─────────────┼─────────────┐
                              ▼             ▼             ▼
                       ┌────────────┐ ┌──────────┐ ┌────────────┐
                       │ WEB        │ │ DOCUMENT │ │ SYNTHESIZER│
                       │ RESEARCHER │ │ ANALYST  │ │            │
                       └─────┬──────┘ └────┬─────┘ └─────┬──────┘
                             │             │             │
                             └──────┬──────┘             │
                                    ▼                    │
                              ORCHESTRATOR               │
                              (re-evaluate)              │
                                    │                    │
                                    └──── ready? ────────┘
                                                         │
                                                   Final Report
```

### Agent Roles

| Agent | Role | Tools |
|-------|------|-------|
| **Orchestrator** | Receives query, creates a plan, routes tasks, re-evaluates after each step | Structured output (Pydantic) |
| **Web Researcher** | Searches the web, cross-references results, records findings | DuckDuckGo search |
| **Document Analyst** | Loads and analyzes user-provided PDFs/text files | PDF/text loader |
| **Synthesizer** | Combines all findings into a structured final report | None (pure LLM reasoning) |

### How It Works

1. **Orchestrator** receives the query and creates a research plan
2. **Orchestrator** routes to the appropriate specialist (web researcher or document analyst)
3. **Specialist agent** performs its task and records findings to shared state
4. **Orchestrator** re-evaluates — need more research? Route again. Enough findings? Route to synthesizer
5. **Synthesizer** combines everything into a report with: Executive Summary, Key Findings, Conflicts, Gaps, Recommendations
6. Loop repeats up to 3 iterations to prevent infinite cycles

## Tech Stack

### Backend
- **[LangGraph](https://github.com/langchain-ai/langgraph)** — Stateful graph for multi-agent orchestration
- **[LangChain](https://github.com/langchain-ai/langchain)** — LLM wrappers, tools, document loaders
- **[OpenAI GPT-4o](https://platform.openai.com/)** — LLM powering all agents
- **[FastAPI](https://fastapi.tiangolo.com/)** — API server with SSE streaming
- **[DuckDuckGo](https://pypi.org/project/ddgs/)** — Web search (no API key needed)
- **[pypdf](https://github.com/py-pdf/pypdf)** — PDF text extraction

### Frontend
- **[Next.js 16](https://nextjs.org/)** — React framework with App Router
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first styling
- **[React Markdown](https://github.com/remarkjs/react-markdown)** — Report rendering

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/multi-agent-research-assistant.git
cd multi-agent-research-assistant

# Backend setup
python3 -m venv .venv
source .venv/bin/activate
pip install -e .

# Set up your API key
cp .env.example .env
# Edit .env and add your OpenAI API key

# Frontend setup
cd frontend
npm install
```

### Running

Start both servers (in separate terminals):

```bash
# Terminal 1: Backend (from project root)
source .venv/bin/activate
uvicorn server:app --reload --port 8000

# Terminal 2: Frontend (from frontend/)
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

### CLI Mode

You can also use the CLI directly:

```bash
source .venv/bin/activate
python -m src.main "What are the latest advances in quantum computing?"
```

## Project Structure

```
├── pyproject.toml              # Python dependencies & project config
├── .env.example                # API key template
├── server.py                   # FastAPI backend with SSE streaming
├── BLOG.md                     # Build journal — architecture decisions & challenges
├── src/
│   ├── main.py                 # CLI entry point (Rich-powered)
│   ├── config.py               # Settings & LLM initialization
│   ├── state.py                # Shared graph state (TypedDict)
│   ├── graph.py                # LangGraph workflow assembly
│   ├── agents/
│   │   ├── orchestrator.py     # Routes tasks to specialist agents
│   │   ├── web_researcher.py   # Searches the web via DuckDuckGo
│   │   ├── document_analyst.py # Reads & analyzes PDFs/text files
│   │   └── synthesizer.py      # Combines findings into final report
│   ├── tools/
│   │   ├── search.py           # DuckDuckGo search tool
│   │   ├── doc_loader.py       # PDF/text file loader + chunker
│   │   └── note_taker.py       # Finding recorder tool
│   └── utils/
│       └── output.py           # Rich console formatting helpers
└── frontend/
    ├── package.json            # Node dependencies
    └── src/app/
        ├── layout.tsx          # Root layout
        ├── page.tsx            # Home page
        ├── globals.css         # Global styles & theme
        └── components/
            └── ResearchApp.tsx # Main research UI (SSE client)
```

## Key Design Decisions

- **SSE streaming** — Backend streams agent updates via Server-Sent Events; frontend renders each step in real-time instead of waiting for the full run
- **Shared state with append semantics** — `Annotated[list[str], add]` in the TypedDict ensures agents accumulate findings instead of overwriting
- **Structured output on orchestrator** — Pydantic model guarantees valid routing decisions, no free-text parsing
- **Manual tool-calling loops** — More control than AgentExecutor; we cap tool calls per agent and the LLM decides when to stop
- **Stateless tools, stateful nodes** — Tools are pure functions; LangGraph nodes handle state updates
- **Iteration guard** — Max 3 orchestrator cycles prevents infinite loops; fallback routing ensures termination

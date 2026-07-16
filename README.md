# Multi-Agent Research Assistant

Ask a research question and get back a sourced report. Four AI agents split the work. One plans, one searches the web, one reads documents you upload, and one writes the report. The browser shows each agent as it runs.

Built with LangGraph, FastAPI, and Next.js.

## How it works

The four agents share one state object and pass control through a graph. The orchestrator is the hub. Every specialist returns to it, and it decides what happens next.

```
query
  |
  v
orchestrator  <-------------------+
  |                               |
  +--> web researcher ------------+
  |                               |
  +--> document analyst ----------+
  |
  +--> synthesizer --> report
```

A run goes like this:

1. The orchestrator reads the query, writes a research plan, and picks which specialist goes first.
2. That specialist does its work and appends what it found to the shared state.
3. Control returns to the orchestrator. It reviews the findings and either routes to another specialist or decides there is enough to write up.
4. The synthesizer turns the findings into a report covering an executive summary, key findings, conflicts between sources, knowledge gaps, and recommendations.

The orchestrator runs at most three times per query, which stops the agents from looping forever. If no documents are uploaded, it never routes to the document analyst.

The backend streams each step to the browser over Server-Sent Events. The UI builds up a chain of the agents as they finish, so a repeated orchestrator step appears as another link rather than jumping back to the start.

## Agents

| Agent | Role |
|-------|------|
| Orchestrator | Writes the plan and routes to specialists. Returns a Pydantic model, so a routing decision is never free text. |
| Web Researcher | Runs up to three DuckDuckGo searches, then summarizes the results with source URLs and a confidence level. |
| Document Analyst | Extracts text from uploaded PDFs and text files and pulls out what is relevant to the query. |
| Synthesizer | Combines every finding into the final report. |

## Setup

You need Python 3.10 or newer, Node.js 20.9 or newer, and an [OpenAI API key](https://platform.openai.com/api-keys).

```bash
git clone https://github.com/Akshats-git/Research-Agent.git
cd Research-Agent

python3 -m venv .venv
source .venv/bin/activate
pip install -e .

cp .env.example .env   # then add your OpenAI API key

cd frontend && npm install
```

## Running

Start the backend and the frontend in separate terminals.

```bash
# terminal 1, from the project root
source .venv/bin/activate
uvicorn server:app --reload --port 8000
```

```bash
# terminal 2, from frontend/
npm run dev
```

Open http://localhost:3000.

## CLI

The agents also run without the frontend.

```bash
source .venv/bin/activate

python -m src.main "What are the latest advances in quantum computing?"
python -m src.main "Summarize the key themes" --files paper.pdf notes.txt
python -m src.main    # interactive prompt
```

## Configuration

The model and the iteration cap are set in `src/config.py`:

```python
MODEL_NAME = "gpt-4o"
MAX_ITERATIONS = 3
```

## Project layout

```
├── server.py                 FastAPI backend, streams updates over SSE
├── src/
│   ├── main.py               CLI entry point
│   ├── config.py             Model settings and LLM setup
│   ├── state.py              Shared graph state
│   ├── graph.py              Wires the agents into the LangGraph workflow
│   ├── agents/               One module per agent
│   └── tools/                Web search and document loading
└── frontend/src/app/
    └── components/
        ├── ResearchApp.tsx   Research UI and SSE client
        └── pipeline.ts       Builds the agent chain from the event stream
```

## Built with

- [LangGraph](https://github.com/langchain-ai/langgraph) for the agent graph and shared state
- [LangChain](https://github.com/langchain-ai/langchain) and OpenAI GPT-4o for the LLM calls and tool binding
- [FastAPI](https://fastapi.tiangolo.com/) for the streaming API
- [Next.js](https://nextjs.org/) and [Tailwind CSS](https://tailwindcss.com/) for the frontend
- [ddgs](https://pypi.org/project/ddgs/) for web search, which needs no API key
- [pypdf](https://github.com/py-pdf/pypdf) for PDF text extraction

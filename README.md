# Multi-Agent Research Assistant

Ask a research question and get back a sourced report. Then keep talking to it. Four AI agents split the work. One plans, one searches the web, one reads documents you upload, and one writes the report. Once a report exists you can ask follow-up questions or request edits. Every exchange is saved in a chat sidebar, like the tools you already use.

Built with LangGraph, FastAPI, and Next.js.

## What it does

- **Runs a real research pipeline.** A new question starts four agents that plan, search, analyse documents, and write a structured report. The progress is streamed to the browser step by step.
- **Understands what you actually want.** Every message is classified first. Replying "ok" or "which sources did you use?" gets a conversational answer instead of re-running the whole pipeline. Ask for changes like "make it shorter" or "add a section on salaries" and it revises the existing report in place.
- **Keeps your history.** Chats live in a sidebar with pin, rename, archive, and delete. History is saved locally, so a reload never loses your work.
- **Reads your files.** Upload PDFs, text, Markdown, or CSV and the document analyst folds them into the research.
- **Exports.** Any report can be downloaded as a PDF.

## How the research pipeline works

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

A research run goes like this:

1. The orchestrator reads the query, writes a plan, and picks which specialist goes first.
2. That specialist does its work and adds what it found to the shared state.
3. Control returns to the orchestrator. It reviews the findings. Then it routes to another specialist or decides there is enough to write up.
4. The synthesizer turns the findings into a report. The report has an executive summary, key findings, conflicts between sources, knowledge gaps, and recommendations.

The orchestrator runs at most three times per query. This keeps the agents from looping forever. If no documents are uploaded, it never routes to the document analyst.

## The conversational layer

Not every message is a research request. So the backend classifies each turn before doing any work. The classifier sees the chat history and whether a report already exists. Then it picks one of three actions.

| Action | When | What happens |
|--------|------|--------------|
| **research** | A genuinely new topic or an explicit request for a report | Runs the full four-agent pipeline |
| **answer** | A follow-up question, a clarification, or an acknowledgement like "ok" or "thanks" | A single conversational reply. No pipeline, no new report |
| **revise** | A request to change the existing report | Rewrites the report with the edit applied and returns the full updated version |

This is what stops the classic failure where every reply, even "ok", starts a brand-new report.

## The agents

| Agent | Role |
|-------|------|
| Orchestrator | Writes the plan and routes to specialists. It returns a Pydantic model, so a routing decision is never free text. |
| Web Researcher | Runs up to three DuckDuckGo searches, then summarises the results with source URLs and a confidence level. |
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

The research pipeline also runs on its own, without the frontend or the conversational layer.

```bash
source .venv/bin/activate

python -m src.main "What are the latest advances in quantum computing?"
python -m src.main "Summarize the key themes" --files paper.pdf notes.txt
python -m src.main    # interactive prompt
```

## Configuration

The model and the orchestrator's iteration cap live in `src/config.py`:

```python
MODEL_NAME = "gpt-4o"
MAX_ITERATIONS = 3
```

## Project layout

```
├── server.py                     FastAPI backend; streams every turn over SSE
├── src/
│   ├── main.py                   CLI entry point
│   ├── config.py                 Model settings and LLM factory
│   ├── state.py                  Shared graph state
│   ├── graph.py                  Wires the agents into the LangGraph workflow
│   ├── conversation.py           Intent router plus answer and revise handlers
│   ├── agents/                   One module per agent
│   └── tools/                    Web search and document loading
└── frontend/src/app/components/
    ├── ResearchApp.tsx           Main view: conversation, input, SSE client
    ├── Sidebar.tsx               Chat history (pin, rename, archive, delete)
    ├── store.ts                  Client chat store, saved to localStorage
    ├── pipeline.ts               Builds the agent chain from the event stream
    └── icons.tsx                 Shared SVG icons
```

## How the backend talks to the browser

The backend exposes one endpoint, `POST /api/chat`. It streams progress back as [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events). Each turn emits an `intent` event with the router's decision. Then it emits either a run of `agent_update` events for research, a `message` event for an answer, or a `report` event for a revision. It finishes with `complete`. The frontend reads the stream and updates the active chat in place.

## Built with

- [LangGraph](https://github.com/langchain-ai/langgraph) for the agent graph and shared state
- [LangChain](https://github.com/langchain-ai/langchain) and OpenAI GPT-4o for the LLM calls and tool binding
- [FastAPI](https://fastapi.tiangolo.com/) for the streaming API
- [Next.js](https://nextjs.org/) and [Tailwind CSS](https://tailwindcss.com/) for the frontend
- [ddgs](https://pypi.org/project/ddgs/) for web search, which needs no API key
- [pypdf](https://github.com/py-pdf/pypdf) for PDF text extraction

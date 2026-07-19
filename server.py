"""FastAPI backend.

Exposes the research graph and the conversational layer over a single
Server-Sent Events endpoint (``/api/chat``). Each turn is first classified as a
new report, a follow-up answer, or an edit to the existing report. Only the
research path runs the full multi-agent pipeline.

SSE event types emitted to the browser:
    intent        {action}                     router's decision for this turn
    start         {query}                       a research run is beginning
    agent_update  {step, agent, ...}            one graph node finished
    message       {content}                     conversational answer (no report)
    report        {report}                      a revised report
    complete      {}                            the turn is done
    error         {message}                     something failed
"""

import json
import asyncio
import tempfile
from typing import AsyncGenerator

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from src.graph import build_graph
from src.conversation import classify_intent, answer_question, revise_report

app = FastAPI(title="Multi-Agent Research Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compiled once at startup and reused across requests.
graph = build_graph()


def _event(event_type: str, data: dict) -> str:
    """Format a single Server-Sent Event frame."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


def _agent_update(step: int, node_name: str, node_state: dict) -> dict:
    """Pick out the fields the UI cares about for a finished graph node."""
    data = {"step": step, "agent": node_name}
    if node_name == "orchestrator":
        data["plan"] = node_state.get("plan", "")
        data["next_agent"] = node_state.get("current_agent", "")
        data["reasoning"] = node_state.get("reasoning", "")
    elif node_name == "web_researcher":
        findings = node_state.get("web_findings", [])
        data["findings_count"] = len(findings)
        data["findings"] = findings
    elif node_name == "document_analyst":
        findings = node_state.get("doc_findings", [])
        data["findings_count"] = len(findings)
        data["findings"] = findings
    elif node_name == "synthesizer":
        data["report"] = node_state.get("final_report", "")
    return data


async def _stream_research(query: str, documents: list[str]) -> AsyncGenerator[str, None]:
    """Run the graph and stream one ``agent_update`` per node as it completes."""
    initial_state = {
        "query": query,
        "plan": "",
        "reasoning": "",
        "web_findings": [],
        "doc_findings": [],
        "documents": documents,
        "final_report": "",
        "current_agent": "",
        "messages": [],
        "iteration": 0,
    }

    yield _event("start", {"query": query})

    step_count = 0
    try:
        for step in graph.stream(initial_state):
            step_count += 1
            for node_name, node_state in step.items():
                yield _event("agent_update", _agent_update(step_count, node_name, node_state))
                await asyncio.sleep(0)  # yield control so the frame flushes promptly
        yield _event("complete", {"step": step_count})
    except Exception as e:
        yield _event("error", {"message": str(e)})


async def _stream_chat(
    message: str,
    history: list[dict],
    current_report: str,
    documents: list[str],
) -> AsyncGenerator[str, None]:
    """Route a chat turn: fresh research, a conversational answer, or a report edit."""
    has_report = bool(current_report)

    try:
        action = await asyncio.to_thread(classify_intent, message, history, has_report)
    except Exception as e:
        yield _event("error", {"message": f"Could not understand the request: {e}"})
        return

    yield _event("intent", {"action": action})

    if action == "research":
        async for frame in _stream_research(message, documents):
            yield frame
        return

    try:
        if action == "revise":
            report = await asyncio.to_thread(revise_report, message, history, current_report)
            yield _event("report", {"report": report})
        else:  # "answer"
            reply = await asyncio.to_thread(answer_question, message, history, current_report)
            yield _event("message", {"content": reply})
        yield _event("complete", {})
    except Exception as e:
        yield _event("error", {"message": str(e)})


async def _save_uploads(files: list[UploadFile] | None) -> list[str]:
    """Persist uploaded files to temp paths the document loader can read."""
    doc_paths: list[str] = []
    if files:
        for f in files:
            if f.filename and f.size:
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f"_{f.filename}")
                tmp.write(await f.read())
                tmp.close()
                doc_paths.append(tmp.name)
    return doc_paths


@app.post("/api/chat")
async def chat(
    message: str = Form(...),
    history: str = Form("[]"),
    current_report: str = Form(""),
    files: list[UploadFile] | None = File(None),
):
    try:
        parsed_history = json.loads(history) if history else []
    except json.JSONDecodeError:
        parsed_history = []

    doc_paths = await _save_uploads(files)

    return StreamingResponse(
        _stream_chat(message, parsed_history, current_report, doc_paths),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/health")
async def health():
    return {"status": "ok"}

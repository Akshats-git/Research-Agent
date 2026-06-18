import json
import asyncio
from typing import AsyncGenerator

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from src.graph import build_graph

app = FastAPI(title="Multi-Agent Research Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

graph = build_graph()


def _event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


async def _stream_research(query: str, documents: list[str]) -> AsyncGenerator[str, None]:
    initial_state = {
        "query": query,
        "plan": "",
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
                event_data = {"step": step_count, "agent": node_name}

                if node_name == "orchestrator":
                    event_data["plan"] = node_state.get("plan", "")
                    event_data["next_agent"] = node_state.get("current_agent", "")
                    event_data["reasoning"] = node_state.get("reasoning", "")
                elif node_name == "web_researcher":
                    event_data["findings_count"] = len(node_state.get("web_findings", []))
                    event_data["findings"] = node_state.get("web_findings", [])
                elif node_name == "document_analyst":
                    event_data["findings_count"] = len(node_state.get("doc_findings", []))
                    event_data["findings"] = node_state.get("doc_findings", [])
                elif node_name == "synthesizer":
                    event_data["report"] = node_state.get("final_report", "")

                yield _event("agent_update", event_data)
                await asyncio.sleep(0)

        yield _event("complete", {"step": step_count})
    except Exception as e:
        yield _event("error", {"message": str(e)})


@app.post("/api/research")
async def research(query: str = Form(...), files: list[UploadFile] | None = File(None)):
    import tempfile
    import os

    doc_paths = []
    if files:
        for f in files:
            if f.filename and f.size:
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f"_{f.filename}")
                tmp.write(await f.read())
                tmp.close()
                doc_paths.append(tmp.name)

    return StreamingResponse(
        _stream_research(query, doc_paths),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/health")
async def health():
    return {"status": "ok"}

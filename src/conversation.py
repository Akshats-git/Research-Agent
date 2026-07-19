"""Conversational layer in front of the research pipeline.

The pipeline itself only knows how to produce a fresh report. But a chat turn
isn't always a research request. The user may just be acknowledging, asking a
follow-up question about findings already gathered, or asking for edits to the
report. This module decides which of those a message is (``classify_intent``)
and handles the two non-pipeline cases (``answer_question``, ``revise_report``).
"""

from typing import Literal

from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage

from src.config import get_llm

# One entry is ``{"role": "user" | "assistant", "content": str}``.
Message = dict


def format_history(history: list[Message], max_len: int = 1200) -> str:
    """Render prior turns as a compact transcript, truncating long reports."""
    lines = []
    for m in history:
        role = m.get("role", "user")
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if len(content) > max_len:
            content = content[:max_len] + " …[truncated]"
        speaker = "User" if role == "user" else "Assistant"
        lines.append(f"{speaker}: {content}")
    return "\n\n".join(lines)


class Intent(BaseModel):
    action: Literal["research", "answer", "revise"] = Field(
        description=(
            "research = run the full research pipeline to produce a NEW report; "
            "answer = reply conversationally from existing context, no new report; "
            "revise = edit the existing report per the user's request"
        )
    )
    reasoning: str = Field(description="Brief reason for the classification")


ROUTER_PROMPT = """You classify the user's LATEST message in a research chat into exactly ONE action.

Actions:
- "research": The user wants NEW research. This means a report on a topic not yet investigated, or a substantially new question that needs fresh web or document research. Examples: "Are SWE jobs dead?", "Research the impact of AI on hiring", "Now look into remote-work trends".
- "revise": The user wants to CHANGE the report that already exists. For example shorten or expand it, add or drop a section, change tone or format, or fix something. Examples: "make it shorter", "add a section on salaries", "remove the recommendations", "rewrite the executive summary".
- "answer": The user is acknowledging, chatting, or asking a question that can be answered from what has already been gathered. This produces NO new research and NO report. Examples: "ok", "thanks", "what did you mean by point 3?", "which sources did you use?", "summarize that in one sentence".

Rules:
- Short acknowledgements or reactions ("ok", "thanks", "got it", "cool", "nice") are ALWAYS "answer". NEVER treat them as a research topic.
- Only choose "research" when genuinely new investigation is required. Do NOT re-run research just because the user replied.
- Only choose "revise" when a report already exists AND the user is asking to change it.
- When torn between "answer" and "research", choose "answer" unless the message is clearly a new research topic or an explicit request to research/report on something."""


def classify_intent(message: str, history: list[Message], has_report: bool) -> str:
    llm = get_llm().with_structured_output(Intent)
    convo = format_history(history)
    context = (
        f"A report {'ALREADY EXISTS' if has_report else 'does NOT exist yet'} in this chat.\n\n"
        f"Conversation so far:\n{convo or '(none)'}\n\n"
        f"Latest user message:\n{message}"
    )
    result = llm.invoke([SystemMessage(content=ROUTER_PROMPT), HumanMessage(content=context)])

    action = result.action
    # A revision needs something to revise; with no report, treat it as research.
    if action == "revise" and not has_report:
        action = "research"
    return action


ANSWER_PROMPT = """You are a helpful research assistant continuing a conversation.

Answer the user's latest message directly and concisely, using the conversation and the current report (if any) as context. Do NOT produce a full formal report. This is a chat reply.

If the user is merely acknowledging (e.g. "ok", "thanks"), respond briefly and offer next steps: they can ask a follow-up, request changes to the report, or start new research. Use light markdown only when it genuinely helps."""


def answer_question(message: str, history: list[Message], current_report: str) -> str:
    llm = get_llm()
    parts = []
    if current_report:
        parts.append(f"Current report:\n{current_report}")
    convo = format_history(history)
    if convo:
        parts.append(f"Conversation so far:\n{convo}")
    parts.append(f"User's latest message:\n{message}")
    response = llm.invoke(
        [SystemMessage(content=ANSWER_PROMPT), HumanMessage(content="\n\n".join(parts))]
    )
    return response.content


REVISE_PROMPT = """You revise an existing research report based on the user's request.

Return the COMPLETE updated report in markdown. Give the full document, not a diff and not just the changed section, with NO commentary before or after it. Preserve everything the user did not ask to change, and keep the report's professional structure."""


def revise_report(message: str, history: list[Message], current_report: str) -> str:
    llm = get_llm()
    parts = []
    convo = format_history(history)
    if convo:
        parts.append(f"Conversation so far:\n{convo}")
    parts.append(f"Current report:\n{current_report}")
    parts.append(f"The user's requested change:\n{message}")
    response = llm.invoke(
        [SystemMessage(content=REVISE_PROMPT), HumanMessage(content="\n\n".join(parts))]
    )
    return response.content

"""Central configuration: environment loading and the shared LLM factory."""

import os

from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = "gpt-4o"
TEMPERATURE = 0.1
MAX_ITERATIONS = 3  # Orchestrator loops before the synthesizer is forced to run.


class MissingAPIKeyError(RuntimeError):
    """Raised when OPENAI_API_KEY is absent at the point an LLM is needed."""


def get_llm():
    """Return a fresh chat model.

    The key is checked here rather than at import time so that importing the
    package never terminates the process. Callers decide how to present the
    failure: the CLI prints it, the API turns it into an error event.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise MissingAPIKeyError(
            "OPENAI_API_KEY is not set. Copy .env.example to .env and add your key."
        )

    from langchain_openai import ChatOpenAI

    return ChatOpenAI(model=MODEL_NAME, temperature=TEMPERATURE, api_key=api_key)


def message_text(response) -> str:
    """Flatten an LLM response to plain text.

    ``content`` is usually a string, but it is a list of content blocks when the
    model replies with anything other than a single block of prose. Callers all
    want text, so normalise here instead of at every call site.
    """
    content = response.content
    if isinstance(content, str):
        return content
    parts = [
        block if isinstance(block, str) else block.get("text", "")
        for block in content
    ]
    return "".join(parts)

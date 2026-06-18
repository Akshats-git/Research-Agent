import os
import sys

from dotenv import load_dotenv
from rich.console import Console

load_dotenv()

console = Console()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    console.print(
        "[bold red]Error:[/bold red] OPENAI_API_KEY not found. "
        "Copy .env.example to .env and add your key."
    )
    sys.exit(1)

MODEL_NAME = "gpt-4o"
MAX_ITERATIONS = 3


def get_llm():
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(model=MODEL_NAME, temperature=0.1, api_key=OPENAI_API_KEY)

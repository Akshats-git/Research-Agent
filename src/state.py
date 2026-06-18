from typing import Annotated
from operator import add
from typing_extensions import TypedDict


class ResearchState(TypedDict):
    query: str
    plan: str
    web_findings: Annotated[list[str], add]
    doc_findings: Annotated[list[str], add]
    documents: list[str]
    final_report: str
    current_agent: str
    messages: Annotated[list, add]
    iteration: int

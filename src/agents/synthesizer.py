from langchain_core.messages import SystemMessage, HumanMessage

from src.config import get_llm
from src.state import ResearchState

SYNTHESIZER_PROMPT = """You are a research synthesizer. Your job is to combine all gathered findings into a comprehensive, well-structured research report.

## Output Format

Produce a report with these sections:

### Executive Summary
A 2-3 paragraph overview of the key findings and conclusions.

### Key Findings
Numbered list of the most important discoveries, each with:
- The finding itself
- Source attribution (web source URL or document name)
- Confidence level (High/Medium/Low)

### Conflicting Information
Any contradictions or disagreements found between sources. If none, state "No significant conflicts identified."

### Knowledge Gaps
Areas where information was insufficient or unavailable. What further research would help?

### Recommendations
Actionable next steps or conclusions based on the findings.

---

## Rules
- Be objective and evidence-based
- Clearly distinguish between facts and interpretations
- Attribute all claims to their sources
- If findings are thin, acknowledge this honestly rather than padding the report
- Write in clear, professional prose"""


def synthesizer_node(state: ResearchState) -> dict:
    llm = get_llm()

    web_findings = state.get("web_findings", [])
    doc_findings = state.get("doc_findings", [])

    findings_text = ""

    if web_findings:
        findings_text += "## Web Research Findings\n\n"
        for i, f in enumerate(web_findings, 1):
            findings_text += f"### Web Finding {i}\n{f}\n\n"

    if doc_findings:
        findings_text += "## Document Analysis Findings\n\n"
        for i, f in enumerate(doc_findings, 1):
            findings_text += f"### Document Finding {i}\n{f}\n\n"

    if not findings_text:
        findings_text = "No findings were gathered. Provide a brief report acknowledging this."

    messages = [
        SystemMessage(content=SYNTHESIZER_PROMPT),
        HumanMessage(content=(
            f"Research query: {state['query']}\n\n"
            f"Research plan: {state.get('plan', 'N/A')}\n\n"
            f"{findings_text}\n"
            "Synthesize all findings into a final research report."
        )),
    ]

    response = llm.invoke(messages)

    return {
        "final_report": response.content,
        "current_agent": "done",
        "messages": [{"role": "synthesizer", "content": "Final report generated"}],
    }

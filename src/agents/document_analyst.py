from langchain_core.messages import SystemMessage, HumanMessage

from src.config import get_llm
from src.state import ResearchState
from src.tools.doc_loader import load_document

DOCUMENT_ANALYST_PROMPT = """You are a document analysis specialist. Your job is to read provided documents and extract information relevant to the research query.

## Instructions
1. Load each provided document using the load_document tool.
2. Analyze the content in the context of the research query and plan.
3. Extract key information including:
   - Main themes and arguments
   - Relevant data, statistics, or quotes
   - How the document relates to the research query
   - Any limitations or biases in the document
4. Compile your analysis into a clear summary.

Be precise and cite specific parts of the documents when possible."""


def document_analyst_node(state: ResearchState) -> dict:
    documents = state.get("documents", [])

    if not documents:
        return {
            "doc_findings": ["No documents were provided for analysis."],
            "current_agent": "orchestrator",
            "messages": [{"role": "document_analyst", "content": "No documents to analyze"}],
        }

    llm = get_llm().bind_tools([load_document])

    messages = [
        SystemMessage(content=DOCUMENT_ANALYST_PROMPT),
        HumanMessage(content=(
            f"Research query: {state['query']}\n\n"
            f"Research plan: {state.get('plan', 'Analyze the documents for relevant information.')}\n\n"
            f"Documents to analyze: {documents}\n\n"
            "Load and analyze each document."
        )),
    ]

    for _ in range(len(documents) + 2):
        response = llm.invoke(messages)
        messages.append(response)

        if not response.tool_calls:
            break

        for tool_call in response.tool_calls:
            result = load_document.invoke(tool_call["args"])
            from langchain_core.messages import ToolMessage
            messages.append(ToolMessage(content=result, tool_call_id=tool_call["id"]))

    final_response = llm.invoke(messages + [
        HumanMessage(content="Now compile your document analysis into a clear summary of findings relevant to the research query.")
    ])

    return {
        "doc_findings": [final_response.content],
        "current_agent": "orchestrator",
        "messages": [{"role": "document_analyst", "content": f"Analyzed {len(documents)} document(s)"}],
    }

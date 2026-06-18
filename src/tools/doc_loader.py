import os

from langchain_core.tools import tool
from langchain_text_splitters import RecursiveCharacterTextSplitter


@tool
def load_document(file_path: str) -> str:
    """Load a PDF or text file and return its contents split into chunks."""
    if not os.path.exists(file_path):
        return f"File not found: {file_path}"

    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == ".pdf":
            from pypdf import PdfReader

            reader = PdfReader(file_path)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        elif ext in (".txt", ".md", ".csv"):
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
        else:
            return f"Unsupported file type: {ext}. Supported: .pdf, .txt, .md, .csv"

        if not text.strip():
            return f"File is empty or could not extract text: {file_path}"

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=2000,
            chunk_overlap=200,
        )
        chunks = splitter.split_text(text)

        output = f"Loaded {len(chunks)} chunk(s) from: {os.path.basename(file_path)}\n\n"
        for i, chunk in enumerate(chunks, 1):
            output += f"--- Chunk {i}/{len(chunks)} ---\n{chunk}\n\n"

        return output
    except Exception as e:
        return f"Error loading {file_path}: {e}"

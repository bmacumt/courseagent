"""Parse PDF and Word files into plain text for grading."""
import logging

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF using PyMuPDF (fitz)."""
    import fitz  # PyMuPDF
    doc = fitz.open(file_path)
    text_parts = []
    for page in doc:
        text_parts.append(page.get_text())
    doc.close()
    return "\n".join(text_parts).strip()


def extract_text_from_docx(file_path: str) -> str:
    """Extract text from .docx using python-docx."""
    from docx import Document
    doc = Document(file_path)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip()).strip()


def parse_file(file_path: str, filename: str) -> str:
    """Parse uploaded file to text. Returns extracted content or raises ValueError."""
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    if ext == "pdf":
        return extract_text_from_pdf(file_path)
    elif ext in ("docx", "doc"):
        if ext == "doc":
            raise ValueError("Legacy .doc format not supported, please use .docx")
        return extract_text_from_docx(file_path)
    else:
        raise ValueError(f"Unsupported file format: .{ext}. Supported: .pdf, .docx")

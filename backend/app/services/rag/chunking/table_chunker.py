"""Table chunker: each table becomes its own chunk, text merged by naive_merge."""
import logging
from app.services.rag.chunking.naive_chunker import naive_merge

logger = logging.getLogger(__name__)


def chunk(
    sections: list[tuple[str, str]],
    lang: str = "zh",
    chunk_token_num: int = 500,
) -> list[str]:
    """Chunk table-heavy documents. Tables stay as independent chunks."""
    if not sections:
        return []

    text_sections = []
    table_sections = []
    for text, layout in sections:
        if layout == "table":
            table_sections.append(text)
        else:
            text_sections.append((text, layout))

    chunks = []
    # Text parts merged normally
    if text_sections:
        chunks.extend(naive_merge(text_sections, chunk_token_num=chunk_token_num))
    # Each table is its own chunk
    for tbl in table_sections:
        if tbl.strip():
            chunks.append(tbl)

    logger.info(f"[table_chunker] {len(chunks)} chunks ({len(table_sections)} tables)")
    return chunks

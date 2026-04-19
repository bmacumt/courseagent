"""Paper chunker: for research papers and reports with academic structure."""
import logging
from app.services.rag.chunking.detector import bullets_category
from app.services.rag.chunking.tree_merge import tree_merge
from app.services.rag.chunking.naive_chunker import naive_merge

logger = logging.getLogger(__name__)


def chunk(
    sections: list[tuple[str, str]],
    lang: str = "zh",
    depth: int = 3,
    chunk_token_num: int = 500,
) -> list[str]:
    """Chunk academic papers. Falls back to book_chunker logic."""
    if not sections:
        return []

    text_sections = [t for t, _ in sections]
    bull = bullets_category(text_sections)

    if bull >= 0:
        logger.info(f"[paper_chunker] Pattern #{bull} detected, tree_merge depth={depth}")
        res = tree_merge(bull, sections, depth, token_limit=chunk_token_num)
        if res:
            return res

    logger.info(f"[paper_chunker] No pattern, naive_merge chunk_token_num={chunk_token_num}")
    return naive_merge(sections, chunk_token_num=chunk_token_num)

"""Book chunker: hierarchical merge with naive_merge fallback."""
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
    """Chunk textbook/course material sections.

    Tries hierarchical merge first; falls back to naive_merge.
    """
    if not sections:
        return []

    eng = lang.lower() == "english"
    sections = list(sections)

    text_sections = [t for t, _ in sections]
    bull = bullets_category(text_sections)

    if bull >= 0:
        logger.info(f"[book_chunker] Pattern #{bull} detected, tree_merge depth={depth}")
        res = tree_merge(bull, sections, depth, token_limit=chunk_token_num)
        if res:
            return res
        logger.warning("[book_chunker] tree_merge empty, falling back to naive_merge")

    logger.info(f"[book_chunker] No pattern detected, naive_merge chunk_token_num={chunk_token_num}")
    return naive_merge(sections, chunk_token_num=chunk_token_num)

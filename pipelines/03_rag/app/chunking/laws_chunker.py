"""Laws-style structured chunker for engineering standards.

Adapted from ragflow/rag/app/laws.py chunk() function.
License: Apache 2.0 (original ragflow code)
"""
import logging
import re
from app.chunking.detector import bullets_category, is_chinese
from app.chunking.tree_merge import tree_merge, remove_contents_table, make_colon_as_title

logger = logging.getLogger(__name__)


def chunk(
    sections: list[tuple[str, str]],
    lang: str = "Chinese",
    depth: int = 2,
) -> list[str]:
    """Chunk sections using laws-style hierarchical merging.

    Args:
        sections: list of (text, layout_type) tuples.
                  For MinerU output, use mineru_adapter.mineru_to_sections() first.
        lang: "Chinese" or "English"
        depth: hierarchy depth for splitting (default 2)

    Returns:
        list of chunk strings, each containing full hierarchical title path.
    """
    if not sections:
        return []

    eng = lang.lower() == "english"

    # Work on a copy
    sections = list(sections)

    # Remove TOC pages
    remove_contents_table(sections, eng)

    # Detect colon-ended lines as titles
    make_colon_as_title(sections)

    # Auto-detect numbering pattern
    text_sections = [t for t, _ in sections]
    bull = bullets_category(text_sections)

    if bull < 0:
        logger.info("No hierarchical numbering detected, falling back to flat sections")
        return [t for t, _ in sections if t.strip()]

    logger.info(f"Detected bullet pattern #{bull}, merging with depth={depth}")

    # Build hierarchical chunks
    res = tree_merge(bull, sections, depth)

    if not res:
        logger.warning("tree_merge produced no chunks, returning flat sections")
        return [t for t, _ in sections if t.strip()]

    return res

"""PPT chunker: each page/slide becomes a chunk."""
import logging

logger = logging.getLogger(__name__)


def chunk(
    sections: list[tuple[str, str]],
    lang: str = "zh",
    chunk_token_num: int = 800,
) -> list[str]:
    """Chunk presentation slides. Each slide is a separate chunk.

    MinerU parses PDFs page by page, so consecutive sections often
    belong to the same page. We merge non-title sections into the
    previous title's chunk.
    """
    if not sections:
        return []

    chunks = []
    current = []

    for text, layout in sections:
        if layout == "title" and current:
            chunks.append("\n".join(current))
            current = []
        if text.strip():
            current.append(text)

    if current:
        chunks.append("\n".join(current))

    logger.info(f"[ppt_chunker] {len(chunks)} slides")
    return chunks

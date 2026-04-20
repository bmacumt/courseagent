"""Chunker dispatcher: route to the right chunker based on doc_type."""
import re

from app.services.rag.token_utils import num_tokens_from_string


def dispatch_chunk(sections, doc_type="book", lang="zh", **kwargs):
    """Dispatch sections to the appropriate chunker.

    Args:
        sections: list of (text, layout_type) tuples
        doc_type: "laws" | "book" | "table" | "paper" | "ppt" | "mooc"
        lang: "zh" or "en"
        **kwargs: passed to the chunker (depth, chunk_token_num, etc.)
    """
    if doc_type == "laws":
        from app.services.rag.chunking.laws_chunker import chunk
        return chunk(sections, lang=lang, **kwargs)
    elif doc_type == "table":
        from app.services.rag.chunking.table_chunker import chunk
        return chunk(sections, lang=lang, **kwargs)
    elif doc_type == "paper":
        from app.services.rag.chunking.paper_chunker import chunk
        return chunk(sections, lang=lang, **kwargs)
    elif doc_type == "ppt":
        from app.services.rag.chunking.ppt_chunker import chunk
        return chunk(sections, lang=lang, **kwargs)
    elif doc_type == "mooc":
        return _chunk_mooc(sections, lang=lang, **kwargs)
    else:
        from app.services.rag.chunking.book_chunker import chunk
        return chunk(sections, lang=lang, **kwargs)


def _chunk_mooc(sections, lang="zh", chunk_token_num=512, overlap_tokens=64, **kwargs):
    """Chunk ASR transcript: ~chunk_token_num tokens per chunk, overlap_tokens overlap, end at sentence boundaries."""
    # Flatten sections into a single text
    full_text = "\n".join(t for t, _ in sections).strip()
    if not full_text:
        return []

    # Split into sentences by sentence-ending punctuation
    sentences = re.split(r'(?<=[。！？\n])', full_text)
    sentences = [s for s in sentences if s.strip()]
    if not sentences:
        return [full_text]

    chunks = []
    current_text = ""
    current_tokens = 0

    for sent in sentences:
        sent_tokens = num_tokens_from_string(sent)

        # If adding this sentence exceeds target, finalize current chunk
        if current_tokens + sent_tokens > chunk_token_num and current_tokens > 0:
            chunks.append(current_text.strip())

            # Build overlap: take last ~overlap_tokens from current chunk
            overlap_text = _tail_tokens(current_text, overlap_tokens)
            current_text = overlap_text + sent
            current_tokens = num_tokens_from_string(current_text)
        else:
            current_text += sent
            current_tokens += sent_tokens

    # Last chunk
    if current_text.strip():
        chunks.append(current_text.strip())

    return chunks


def _tail_tokens(text: str, n_tokens: int) -> str:
    """Return the tail of text that is approximately n_tokens long."""
    from app.services.rag.token_utils import _enc
    tokens = _enc.encode(text)
    if len(tokens) <= n_tokens:
        return text
    return _enc.decode(tokens[-n_tokens:])

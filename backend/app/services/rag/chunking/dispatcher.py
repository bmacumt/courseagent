"""Chunker dispatcher: route to the right chunker based on doc_type."""


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
    else:
        from app.services.rag.chunking.book_chunker import chunk
        return chunk(sections, lang=lang, **kwargs)

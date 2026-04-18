"""Convert MinerU content_list.json to sections format for tree_merge."""


def mineru_to_sections(content_list: list[dict]) -> list[tuple[str, str]]:
    """Convert MinerU content_list to (text, layout_type) tuples.

    MinerU content_list format (per block):
      - type: "text" | "table" | "image"
      - text_level: int | absent (present = heading, absent = body)
      - text: str
      - table_body: str (HTML, for table blocks)
    """
    sections = []
    for block in content_list:
        btype = block.get("type", "")
        if btype == "text":
            text = block.get("text", "").strip()
            if not text:
                continue
            layout = "title" if block.get("text_level") is not None else ""
            sections.append((text, layout))
        elif btype == "table":
            tbody = block.get("table_body", "").strip()
            if tbody:
                sections.append((tbody, "table"))
        # image blocks skipped for text chunking
    return sections

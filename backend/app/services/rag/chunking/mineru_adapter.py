"""Convert MinerU content_list.json to sections format for chunkers."""
import re


def _html_table_to_markdown(html: str) -> str:
    """Convert HTML table to Markdown format for better LLM readability."""
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL | re.IGNORECASE)
    if not rows:
        return html

    parsed_rows = []
    for row_html in rows:
        cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', row_html, re.DOTALL | re.IGNORECASE)
        cells = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
        if cells:
            parsed_rows.append(cells)

    if not parsed_rows:
        return html

    # Normalize column count
    max_cols = max(len(r) for r in parsed_rows)
    for r in parsed_rows:
        while len(r) < max_cols:
            r.append("")

    lines = []
    # Header row
    lines.append("| " + " | ".join(parsed_rows[0]) + " |")
    lines.append("| " + " | ".join(["---"] * max_cols) + " |")
    # Data rows
    for r in parsed_rows[1:]:
        lines.append("| " + " | ".join(r) + " |")

    return "\n".join(lines)


def mineru_to_sections(content_list: list[dict]) -> list[tuple[str, str]]:
    """Convert MinerU content_list to (text, layout_type) tuples.

    MinerU content_list format (per block):
      - type: "text" | "table" | "image" | "equation"
      - text_level: int | absent (present = heading, absent = body)
      - text: str
      - table_body: str (HTML)
      - table_caption: list[str]
      - table_footnote: list[str]
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
            parts = []
            for cap in block.get("table_caption", []):
                cap = cap.strip()
                if cap:
                    parts.append(cap)
            tbody = block.get("table_body", "").strip()
            if tbody:
                parts.append(_html_table_to_markdown(tbody))
            for fn in block.get("table_footnote", []):
                fn = fn.strip()
                if fn:
                    parts.append(fn)
            if parts:
                sections.append(("\n".join(parts), "table"))
        elif btype == "equation":
            text = block.get("text", "").strip()
            if text:
                sections.append((text, "equation"))
        # image blocks skipped
    return sections

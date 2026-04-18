"""Naive merge chunker for non-structured documents.

Adapted from ragflow/rag/nlp/__init__.py naive_merge().
License: Apache 2.0
"""
import re
from app.services.rag.token_utils import num_tokens_from_string


def naive_merge(
    sections: str | list,
    chunk_token_num: int = 500,
    delimiter: str = "\n。；！？",
    overlapped_percent: float = 0,
) -> list[str]:
    """Merge sections into chunks respecting token limit.

    Args:
        sections: text string or list of (text, layout) tuples
        chunk_token_num: max tokens per chunk
        delimiter: delimiter characters
        overlapped_percent: overlap percentage between chunks (0-100)
    """
    if not sections:
        return []
    if isinstance(sections, str):
        sections = [sections]
    if isinstance(sections[0], str):
        sections = [(s, "") for s in sections]

    cks = [""]
    tk_nums = [0]

    def add_chunk(t, pos):
        nonlocal cks, tk_nums
        tnum = num_tokens_from_string(t)
        if not pos:
            pos = ""
        if tnum < 8:
            pos = ""
        if cks[-1] == "" or tk_nums[-1] > chunk_token_num * (100 - overlapped_percent) / 100.:
            if cks and overlapped_percent > 0:
                overlapped = cks[-1]
                t = overlapped[int(len(overlapped) * (100 - overlapped_percent) / 100.):] + t
            if t.find(pos) < 0:
                t += pos
            cks.append(t)
            tk_nums.append(tnum)
        else:
            if cks[-1].find(pos) < 0:
                t += pos
            cks[-1] += t
            tk_nums[-1] += tnum

    custom_delimiters = [m.group(1) for m in re.finditer(r"`([^`]+)`", delimiter)]
    has_custom = bool(custom_delimiters)
    if has_custom:
        custom_pattern = "|".join(re.escape(t) for t in sorted(set(custom_delimiters), key=len, reverse=True))
        cks, tk_nums = [], []
        for sec, pos in sections:
            split_sec = re.split(r"(%s)" % custom_pattern, sec, flags=re.DOTALL)
            for sub_sec in split_sec:
                if re.fullmatch(custom_pattern, sub_sec or ""):
                    continue
                text = "\n" + sub_sec
                local_pos = pos
                if num_tokens_from_string(text) < 8:
                    local_pos = ""
                if local_pos and text.find(local_pos) < 0:
                    text += local_pos
                cks.append(text)
                tk_nums.append(num_tokens_from_string(text))
        return cks

    for sec, pos in sections:
        add_chunk("\n" + sec, pos)

    return cks

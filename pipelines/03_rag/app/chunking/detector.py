# From ragflow/rag/nlp/__init__.py lines 209-265
# License: Apache 2.0
import re
from app.chunking.patterns import BULLET_PATTERN, not_bullet


def bullets_category(sections):
    """Auto-detect which numbering pattern a document uses."""
    hits = [0] * len(BULLET_PATTERN)
    for i, pro in enumerate(BULLET_PATTERN):
        for sec in sections:
            sec = sec.strip() if isinstance(sec, str) else str(sec).strip()
            for p in pro:
                if re.match(p, sec) and not not_bullet(sec):
                    hits[i] += 1
                    break
    maximum = 0
    res = -1
    for i, h in enumerate(hits):
        if h <= maximum:
            continue
        res = i
        maximum = h
    return res


def is_chinese(text):
    if not text:
        return False
    chinese = 0
    for ch in text:
        if '\u4e00' <= ch <= '\u9fff':
            chinese += 1
    return chinese / len(text) > 0.2


def is_english(texts):
    if not texts:
        return False
    pattern = re.compile(r"[`a-zA-Z0-9\s.,':;/\"?<>!\(\)\-]")
    if isinstance(texts, str):
        texts = list(texts)
    elif isinstance(texts, list):
        texts = [t for t in texts if isinstance(t, str) and t.strip()]
    else:
        return False
    if not texts:
        return False
    eng = sum(1 for t in texts if pattern.fullmatch(t.strip()))
    return (eng / len(texts)) > 0.8

# From ragflow/rag/nlp/__init__.py lines 847-977, 1498-1577
# License: Apache 2.0
# Removed: rag_tokenizer, RAGFlowPdfParser dependencies
import re
from app.chunking.patterns import BULLET_PATTERN


class Node:
    def __init__(self, level, depth=-1, texts=None):
        self.level = level
        self.depth = depth
        self.texts = texts or []
        self.children = []

    def add_child(self, child_node):
        self.children.append(child_node)

    def get_children(self):
        return self.children

    def get_level(self):
        return self.level

    def get_texts(self):
        return self.texts

    def set_texts(self, texts):
        self.texts = texts

    def add_text(self, text):
        self.texts.append(text)

    def clear_text(self):
        self.texts = []

    def __repr__(self):
        return f"Node(level={self.level}, texts={self.texts}, children={len(self.children)})"

    def build_tree(self, lines):
        stack = [self]
        for level, text in lines:
            if self.depth != -1 and level > self.depth:
                stack[-1].add_text(text)
                continue
            while len(stack) > 1 and level <= stack[-1].get_level():
                stack.pop()
            node = Node(level=level, texts=[text])
            stack[-1].add_child(node)
            stack.append(node)
        return self

    def get_tree(self):
        tree_list = []
        self._dfs(self, tree_list, [])
        return tree_list

    def _dfs(self, node, tree_list, titles):
        level = node.get_level()
        texts = node.get_texts()
        child = node.get_children()

        if level == 0 and texts:
            tree_list.append("\n".join(titles + texts))

        if 1 <= level <= self.depth:
            path_titles = titles + texts
        else:
            path_titles = titles

        if level > self.depth and texts:
            tree_list.append("\n".join(path_titles + texts))
        elif not child and (1 <= level <= self.depth):
            tree_list.append("\n".join(path_titles))

        for c in child:
            self._dfs(c, tree_list, path_titles)


def not_title(txt):
    if re.match(r"第[零一二三四五六七八九十百0-9]+条", txt):
        return False
    if len(txt.split()) > 12 or (txt.find(" ") < 0 and len(txt) >= 32):
        return True
    return re.search(r"[,;，。；！!]", txt)


def tree_merge(bull, sections, depth):
    """Build hierarchical chunks from numbered sections.

    Args:
        bull: Pattern index from bullets_category(), -1 if no pattern detected
        sections: list of (text, layout_type) tuples
        depth: hierarchy depth to split at (default 2)
    """
    if not sections or bull < 0:
        return sections
    if isinstance(sections[0], type("")):
        sections = [(s, "") for s in sections]

    sections = [(t, o) for t, o in sections if
                t and len(t.split("@")[0].strip()) > 1 and not re.match(r"[0-9]+$", t.split("@")[0].strip())]

    def get_level(bull, section):
        text, layout = section
        text = re.sub(r"\u3000", " ", text).strip()
        for i, title in enumerate(BULLET_PATTERN[bull]):
            if re.match(title, text.strip()):
                return i + 1, text
        else:
            if re.search(r"(title|head)", layout) and not not_title(text):
                return len(BULLET_PATTERN[bull]) + 1, text
            else:
                return len(BULLET_PATTERN[bull]) + 2, text

    level_set = set()
    lines = []
    for section in sections:
        level, text = get_level(bull, section)
        if not text.strip("\n"):
            continue
        lines.append((level, text))
        level_set.add(level)

    sorted_levels = sorted(list(level_set))
    if not sorted_levels:
        return []

    if depth <= len(sorted_levels):
        target_level = sorted_levels[depth - 1]
    else:
        target_level = sorted_levels[-1]

    if target_level == len(BULLET_PATTERN[bull]) + 2:
        target_level = sorted_levels[-2] if len(sorted_levels) > 1 else sorted_levels[0]

    root = Node(level=0, depth=target_level, texts=[])
    root.build_tree(lines)

    return [element for element in root.get_tree() if element]


def remove_contents_table(sections, eng=False):
    """Remove table-of-contents pages from sections."""
    i = 0
    while i < len(sections):
        def get(i):
            nonlocal sections
            return (sections[i] if isinstance(sections[i],
                                              type("")) else sections[i][0]).strip()

        if not re.match(r"(contents|目录|目次|table of contents|致谢|acknowledge)$",
                        re.sub(r"( | |\u3000)+", "", get(i).split("@@")[0], flags=re.IGNORECASE)):
            i += 1
            continue
        sections.pop(i)
        if i >= len(sections):
            break
        prefix = get(i)[:3] if not eng else " ".join(get(i).split()[:2])
        while not prefix:
            sections.pop(i)
            if i >= len(sections):
                break
            prefix = get(i)[:3] if not eng else " ".join(get(i).split()[:2])
        sections.pop(i)
        if i >= len(sections) or not prefix:
            break
        for j in range(i, min(i + 128, len(sections))):
            if not re.match(prefix, get(j)):
                continue
            for _ in range(i, j):
                sections.pop(i)
            break


def make_colon_as_title(sections):
    """Detect lines ending with colons as section headers."""
    if not sections:
        return []
    if isinstance(sections[0], type("")):
        return sections
    i = 0
    while i < len(sections):
        txt, layout = sections[i]
        i += 1
        txt = txt.split("@")[0].strip()
        if not txt:
            continue
        if txt[-1] not in ":：":
            continue
        txt = txt[::-1]
        arr = re.split(r"([。？！!?;；]| \.)", txt)
        if len(arr) < 2 or len(arr[1]) < 32:
            continue
        sections.insert(i - 1, (arr[0][::-1], "title"))
        i += 1

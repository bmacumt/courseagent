"""Prompt template loader with Jinja2 rendering.

Adapted from ragflow/rag/prompts/template.py
License: Apache 2.0
"""
import os
from jinja2 import Environment

PROMPT_DIR = os.path.join(os.path.dirname(__file__), "templates")
_jinja_env = Environment()
_loaded_prompts = {}


def load_prompt(name: str) -> str:
    """Load a .md prompt template from templates/ directory."""
    if name in _loaded_prompts:
        return _loaded_prompts[name]

    path = os.path.join(PROMPT_DIR, f"{name}.md")
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Prompt '{name}.md' not found in {PROMPT_DIR}")

    with open(path, "r", encoding="utf-8") as f:
        content = f.read().strip()
        _loaded_prompts[name] = content
    return content


def render_prompt(name: str, **kwargs) -> str:
    """Load and render a Jinja2 prompt template."""
    template_str = load_prompt(name)
    template = _jinja_env.from_string(template_str)
    return template.render(**kwargs)

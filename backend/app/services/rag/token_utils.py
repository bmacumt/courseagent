import tiktoken

_enc = tiktoken.get_encoding("cl100k_base")


def num_tokens_from_string(text: str) -> int:
    return len(_enc.encode(text))


def truncate(text: str, max_tokens: int) -> str:
    tokens = _enc.encode(text)
    if len(tokens) <= max_tokens:
        return text
    return _enc.decode(tokens[:max_tokens])

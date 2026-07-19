_NESTED_KEYS = ("anyOf", "oneOf", "allOf")
_UNSUPPORTED_KEYS = ("$schema", "$id", "additionalProperties")


def _sanitize(schema):
    if not isinstance(schema, dict):
        return schema

    out = {k: v for k, v in schema.items() if k not in _UNSUPPORTED_KEYS}

    if "properties" in out and isinstance(out["properties"], dict):
        out["properties"] = {k: _sanitize(v) for k, v in out["properties"].items()}
        out.setdefault("type", "object")

    for key in _NESTED_KEYS:
        if isinstance(out.get(key), list):
            out[key] = [_sanitize(v) for v in out[key]]

    if "items" in out:
        out["items"] = _sanitize(out["items"])
    elif out.get("type") == "array":
        out["items"] = {"type": "string"}

    return out


def sanitize_for_gemini(tools: list) -> list:
    sanitized = []
    for tool in tools:
        schema = getattr(tool, "args_schema", None)
        if isinstance(schema, dict):
            tool = tool.model_copy(update={"args_schema": _sanitize(schema)})
        sanitized.append(tool)
    return sanitized

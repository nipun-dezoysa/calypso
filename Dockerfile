FROM node:22-alpine AS client-builder

WORKDIR /client

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./

# Empty: the browser calls /api/v1/* on the same origin that served the page.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build


FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS deps

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# `--frozen` installs exactly what uv.lock pins. Without it the build resolves
# the newest of every `>=` dependency, which is how an incompatible
# mcp/langchain-mcp-adapters pair reached a release. Run `uv lock` to upgrade.
COPY server/pyproject.toml server/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project


FROM python:3.13-slim-bookworm AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 curl tesseract-ocr nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Stdio MCP servers are commonly launched via `npx`/`uvx`; node/npm come from
# apt above, and `uv`/`uvx` are installed straight from PyPI since the `deps`
# stage's uv binaries aren't at a stable, guessable path in this image.
RUN pip install --no-cache-dir uv

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN useradd --create-home --uid 1000 calypso \
    && mkdir -p /app/data \
    && chown calypso:calypso /app/data

COPY --from=deps --chown=calypso:calypso /app/.venv /app/.venv
COPY --chown=calypso:calypso server/ ./
COPY --from=client-builder --chown=calypso:calypso /client/dist ./static

ENV STATIC_DIR="/app/static" \
    DATABASE_URL="sqlite+aiosqlite:////app/data/calypso.db" \
    KB_UPLOAD_DIR="/app/data/kb_files" \
    ATTACHMENT_UPLOAD_DIR="/app/data/attachment_files" \
    CHROMA_PERSIST_DIR="/app/data/chroma_db" \
    FASTEMBED_CACHE_PATH="/app/data/fastembed_cache"

VOLUME ["/app/data"]

USER calypso

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:8000/openapi.json > /dev/null || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# Calypso

A local AI workspace for running autonomous agents, MCP servers, and multi-model workflows.

Calypso runs on your own machine. You bring the model (a local Ollama instance, or an API key for OpenAI, Anthropic, Google, or Azure) and Calypso handles the rest: agents with their own tools and knowledge, multi-agent workflows you build visually, and a chat interface to run them.



https://github.com/user-attachments/assets/aff0a243-7298-4c73-acc0-4e64cf9f017d



---

## Quick start

The recommended way to run Calypso is the published image. It bundles the UI and the API in one container.

```bash
docker run -d \
  --name calypso \
  -p 8000:8000 \
  -v calypso-data:/app/data \
  --add-host=host.docker.internal:host-gateway \
  --restart unless-stopped \
  nipundezoysa/calypso:latest
```

Open **[http://localhost:8000](http://localhost:8000)**.

Two flags matter:

- **`-v calypso-data:/app/data`** - everything you create (database, agents, workflows, chat history, uploaded documents, vector index) lives here. Skip it and your work disappears when the container is removed.
- **`--add-host=host.docker.internal:host-gateway`** - lets the container reach services on your host, which you need if you run Ollama locally. Harmless otherwise.

To upgrade, pull the new image and recreate the container. The volume carries your data across:

```bash
docker pull nipundezoysa/calypso:latest
docker rm -f calypso
# then re-run the command above
```

Pin a version instead of `latest` if you'd rather upgrade deliberately - see the [available tags](https://hub.docker.com/r/nipundezoysa/calypso/tags).

### First run

1. **Add a provider** - AI Providers. For a local Ollama running on your host, use `http://host.docker.internal:11434` as the URL (not `localhost`, which points at the container itself).
2. **Create an agent** - give it a system prompt, pick a model, optionally attach MCP servers and knowledge base collections.
3. **Chat with it**, or wire several agents together in a workflow.

---

## What's inside

- **Agents** - a system prompt, a model, a temperature, plus any MCP tools, knowledge collections and graph databases you attach. Each agent keeps its own chat threads.
- **Workflows** - a visual graph builder. Agent nodes run in sequence, passing output forward; condition nodes branch on the result. Every agent node carries its own per-workflow instructions, so the same underlying agent can behave differently in different workflows.
- **Workflow designer** - describe the workflow you want, in the panel behind the *Designer* button on the canvas, and it gets drafted for you: nodes, branches, per-node instructions and all. It reads whatever is on the canvas, so "add a fact-check step at the end" works as well as building from scratch, and it only ever wires in agents, models and knowledge collections you actually have. Nothing is written until you press Save, and *Undo design* puts the canvas back.



https://github.com/user-attachments/assets/c3adfaf1-927b-4d91-87df-d5c502822e6d



- **Streaming** - answers arrive a word at a time rather than all at once at the end, which matters most on a local model that can sit on a reply for minutes. Workflows stream too, naming each step as it takes its turn, and tool calls are announced as they run. The stop button next to the composer ends a generation early and keeps the part already written.
- **Attachments** - send files along with a chat message: PDF, DOCX, TXT, Markdown, PNG and JPG. Calypso extracts the text and puts it in the prompt, so the agent can read a contract or a report without you pasting it. Images are sent to the model as pictures where the model has vision, and run through OCR either way, so a screenshot of a table still works on a text-only model. Attachments stay in the thread and are re-sent with later turns, so follow-up questions about the same file work.
- **MCP servers** - connect tools over `stdio`, `streamable_http`, `sse`, or `websocket`. Calypso discovers each server's tools and exposes them to the agents you attach them to.
- **Graph databases** - point Calypso at a Neo4j database over Bolt and attach it to an agent. The agent gets two tools per graph: one that describes the schema (node labels, relationship types, and how they connect) and one that runs a Cypher query. Connections are read-only by default, so the database itself rejects writes, and each carries its own query timeout and row limit.
- **Knowledge base** - upload PDF, TXT, or Markdown files into collections. They're chunked, embedded, and retrieved as context at query time. Vector store is ChromaDB (local, default) or Qdrant; embeddings are FastEmbed (local, default) or Nomic.
- **Providers** - OpenAI, Anthropic, Google Gemini, Azure OpenAI, Ollama, and any OpenAI-compatible endpoint via a custom base URL. Keys are stored in your local database and go nowhere but the provider.

The API is self-documenting at **[http://localhost:8000/docs](http://localhost:8000/docs)**.

---

## Other ways to run it

### Build the image yourself

```bash
git clone https://github.com/nipun-dezoysa/calypso.git
cd calypso
docker build -t calypso:local .
docker run -d -p 8000:8000 -v calypso-data:/app/data calypso:local
```

### From source, for development

Frontend and backend run separately here, with vite proxying `/api/v1` to the API. Requires **Python 3.13+**, [**uv**](https://docs.astral.sh/uv/), and **Node 20+**.

```bash
# ── terminal 1: API on :8000 ──
cd server
uv sync
uv run fastapi dev main.py

# ── terminal 2: UI on :5173 ──
cd client
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). State is written to `server/calypso.db`, `server/chroma_db/`, and `server/kb_files/`.

In this mode the API doesn't serve the frontend - it only mounts a bundle when a `static/` directory sits next to it, which is how the Docker image works. Nothing to configure either way.

---

## Configuration

Every setting is optional; the defaults below are what the image uses. Providers, keys, and knowledge base settings are configured in the UI, not here.

| Variable | Default (in image) | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite+aiosqlite:////app/data/calypso.db` | SQLAlchemy async database URL |
| `KB_UPLOAD_DIR` | `/app/data/kb_files` | Where uploaded documents are stored |
| `CHROMA_PERSIST_DIR` | `/app/data/chroma_db` | Local ChromaDB persistence directory |
| `FASTEMBED_CACHE_PATH` | `/app/data/fastembed_cache` | Cache for downloaded embedding models |
| `STATIC_DIR` | `/app/static` | Built frontend bundle; unset in local dev |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins |
| `CORS_ORIGIN_REGEX` | localhost/127.0.0.1, any port | Regex alternative to the list above |
| `DEFAULT_USERNAME` | `admin` | Username seeded on first boot |
| `DEFAULT_PASSWORD` | `admin` | Password seeded on first boot |
| `JWT_SECRET` | generated once, stored in the database | Token signing key |
| `JWT_EXPIRE_DAYS` | `365` | Access token lifetime |
| `JWT_ALGORITHM` | `HS256` | Token signing algorithm |
| `HISTORY_TOKEN_BUDGET` | `6000` | History ceiling for models with no context window set; `0` sends the whole thread |

The UI and API share an origin in the image, so CORS only matters if you call the API from somewhere else.

### Authentication

The API is behind a JWT bearer token. On first boot the server seeds a single account from `DEFAULT_USERNAME` / `DEFAULT_PASSWORD` and flags it as unchanged, so the UI sends you straight to a *choose your credentials* screen after the first sign-in. The defaults only apply to an empty database - changing those variables later does nothing.

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `POST /api/v1/auth/login` | none | Exchange username + password for a token |
| `GET /api/v1/auth/me` | bearer | The signed-in user, including `must_change_credentials` |
| `PUT /api/v1/auth/credentials` | bearer | Change username and/or password; returns a fresh token |
| `POST /api/v1/chat/{id}/ask` | **none** | Public, so other applications can call your agents |
| `POST /api/v1/chat/{id}/ask/stream` | **none** | The same, streamed back as server-sent events |
| everything else | bearer | |

`/ask` is deliberately left open: it returns answer text only and never exposes provider secret keys, which is exactly why the rest of the API is closed. `/ask/stream` is open for the same reason - it is the same capability over a different transport.

Changing a password invalidates every token issued before the change - tokens carry a fingerprint of the stored password hash. If `JWT_SECRET` is not set the server generates one on first boot and keeps it in the database, so tokens survive restarts.

### Streaming

`POST /api/v1/chat/{id}/ask/stream` takes the same body as `/ask` and answers
with `text/event-stream`. Each frame is one JSON object:

| Event | Payload | Meaning |
| --- | --- | --- |
| `start` | `thread_id` | The thread this answer will be saved to, sent before the model runs |
| `token` | `text` | A piece of the answer. Append them in order |
| `node` | `name` | A workflow step has begun. Its tokens are its own, so clear what the previous step wrote |
| `tool` | `name` | An MCP tool is being called |
| `done` | `thread_id`, `answer`, `stopped` | The finished answer, as saved |
| `error` | `detail` | The run failed. Nothing is saved |

Closing the connection stops the generation. Whatever had streamed by then is
still written to the thread, so stopping mid-answer keeps the part you got
instead of throwing the turn away - which is what the UI's stop button does.
The generation itself outlives the request that started it just long enough to
save; it is not tied to the connection.

`/ask` is unchanged and still returns the whole answer in one response, for
callers that would rather not parse a stream.

### Conversation history

Every turn replays the thread so far, which is what gives an agent its memory -
but a thread left to grow will eventually overrun the model's context window,
and on a metered provider it pays for the same old turns again with each new
message. So the replay is capped: turns are kept newest first until the budget
is used up, and what falls outside is left out, with a note telling the model the
conversation did not start where it appears to. Attachment text and images count
against the budget too, since a PDF costs far more than anything typed alongside
it.

**The budget comes from the model.** Each model can be given a *context window*
when you add or edit its provider, and the history is allowed half of it, the
rest has to hold the system prompt, the knowledge-base chunks, the question with
its attachments, and the reply. So a 200k Claude replays far more of a
conversation than a 4k local model, instead of both being held to one figure
picked to be safe on the smaller one. The field suggests a size for models it
recognises, including Ollama tags like `llama3.1:8b`, and you can override it.

Models with no window set fall back to `HISTORY_TOKEN_BUDGET`, which is also the
global off switch: set it to `0` and the whole thread is sent, whatever any model
says. In a workflow each node is sized by its own model, so a step on a large
model is not cut down to fit a step on a small one.

Turns are dropped rather than summarised on purpose. A summary means another
full generation before the real answer can start, which on a local model is
minutes of waiting for something the user did not ask for.

One caveat for Ollama: the sizes suggested are the *model's* limit, but Ollama
serves a smaller `num_ctx` unless the Modelfile raises it. If answers start
failing on a local model, lower its window here to match what Ollama actually
serves.

---

## Tech stack

**Backend** - FastAPI, SQLAlchemy (async, SQLite), LangChain and LangGraph, ChromaDB / Qdrant, FastEmbed, Neo4j.

**Frontend** - React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Flow.

Releases are built and pushed to Docker Hub automatically by [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml) when a GitHub release is published.

---

## Contributing

Contributions are welcome - issues, feature ideas, and pull requests alike.

If you're picking something up:

1. Fork the repo and branch off `main`.
2. Follow the development setup above so you can see your change running.
3. Keep the frontend clean with `npm run lint`, and match the style of the code around you.
4. Confirm `docker build -t calypso:test .` still succeeds if you touched dependencies, the Dockerfile, or anything under `server/`.
5. Open a PR describing what changed and how you verified it.

Not sure where to start, or unsure whether an idea fits? Open an issue first and let's talk it through - cheaper than building the wrong thing.

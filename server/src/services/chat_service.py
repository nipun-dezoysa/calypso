import asyncio
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone

from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.messages.content import create_image_block
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.agent_model import Agent
from src.models.attachment_model import KIND_IMAGE, Attachment, AttachmentStatus
from src.models.kb_collection_model import KbCollection
from src.models.llm_model import LLMModel
from src.models.mcp_server_model import McpServer
from src.models.message_model import Message
from src.models.node_model import NODE_TYPE_AGENT, Node
from src.models.thread_model import THREAD_TYPE_AGENT, THREAD_TYPE_WORKFLOW, Thread
from src.models.workflow_agent_model import WorkflowAgent
from src.models.workflow_model import Workflow
from src.services import attachment_extract, kb_vectorstore, mcp_client, tool_schema
from src.services.attachment_service import remove_file
from src.services.kb_settings_service import KbSettingsService
from src.services.kb_vectorstore import KbConfig
from src.services.llm_factory import build_chat_model
from src.services.workflow_builder_service import build_workflow_graph, latest_text

RAG_TOP_K_PER_COLLECTION = 4
RAG_MAX_CHUNKS = 8
MCP_MAX_TOOL_ITERATIONS = 6
DEFAULT_CREATIVITY = 50
MAX_HISTORY_IMAGES = 4
RETRIEVAL_QUERY_CHARS = 500
STOPPED_WITH_NOTHING = "_(stopped before the model produced any output)_"

Emit = Callable[[dict], Awaitable[None]]


@dataclass
class RunConfig:
    """Everything one LLM turn needs, flattened. A chat agent and a workflow
    agent node resolve to this same shape, so they share one execution path."""

    llm_model: LLMModel
    creativity: int
    instructions: str
    collections: list[KbCollection]
    mcp_servers: list[McpServer]


class ChatService:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def answer(
        self,
        target_id: str,
        question: str,
        thread_id: str | None = None,
        attachments: list[Attachment] | None = None,
    ) -> tuple[str, str] | None:
        attachments = attachments or []
        agent = await self.db.get(Agent, target_id)
        if agent is not None:
            return await self._answer_agent(agent, question, thread_id, attachments)

        workflow = await self.db.get(Workflow, target_id)
        if workflow is not None:
            return await self._answer_workflow(
                workflow, question, thread_id, attachments
            )

        return None

    async def run_streaming(
        self,
        target_id: str,
        question: str,
        thread_id: str | None,
        attachments: list[Attachment],
        emit: Emit,
        stop: asyncio.Event,
    ) -> None:

        agent = await self.db.get(Agent, target_id)
        workflow = None if agent is not None else await self.db.get(Workflow, target_id)
        if agent is None and workflow is None:
            await emit(
                {
                    "type": "error",
                    "detail": f"No agent or workflow with id '{target_id}'",
                }
            )
            return

        owner_id = agent.id if agent is not None else workflow.id
        thread: Thread | None = None
        history: list[AIMessage | HumanMessage] = []
        if thread_id is not None:
            thread = await self.db.get(Thread, thread_id)
            if thread is None or (thread.agent_id or thread.workflow_id) != owner_id:
                await emit(
                    {
                        "type": "error",
                        "detail": "that thread does not belong to this agent or workflow",
                    }
                )
                return
            history = _history_from(thread)

        is_new = thread is None
        if thread is None:
            thread = Thread(
                id=str(uuid.uuid4()),
                type=THREAD_TYPE_AGENT if agent is not None else THREAD_TYPE_WORKFLOW,
                agent_id=agent.id if agent is not None else None,
                workflow_id=workflow.id if workflow is not None else None,
                messages=[],
            )
        await emit({"type": "start", "thread_id": thread.id})

        try:
            if agent is not None:
                answer = await self._run_turn(
                    _config_from_agent(agent),
                    question,
                    history,
                    attachments=attachments,
                    emit=emit,
                    stop=stop,
                )
            else:
                answer = await self._run_workflow(
                    workflow, question, history, attachments, emit=emit, stop=stop
                )
        except Exception as exc: 
            await self.db.rollback()
            await emit({"type": "error", "detail": str(exc)})
            return

        stopped = _stopped(stop)
        if stopped and not answer:
            answer = STOPPED_WITH_NOTHING

        if is_new:
            self.db.add(thread)
            await self.db.flush()

        saved_id, answer = await self._persist_exchange(
            thread, question, answer, attachments
        )
        await emit(
            {
                "type": "done",
                "thread_id": saved_id,
                "stopped": stopped,
                "answer": answer,
            }
        )

    # ── Agent ─────────────────────────────────────────────────────────────

    async def _answer_agent(
        self,
        agent: Agent,
        question: str,
        thread_id: str | None,
        attachments: list[Attachment],
    ) -> tuple[str, str] | None:
        thread: Thread | None = None
        history: list[AIMessage | HumanMessage] = []
        if thread_id is not None:
            thread = await self.db.get(Thread, thread_id)
            if thread is None or thread.agent_id != agent.id:
                return None
            history = _history_from(thread)

        answer = await self._run_turn(
            _config_from_agent(agent), question, history, attachments=attachments
        )

        if thread is None:
            thread = Thread(type=THREAD_TYPE_AGENT, agent_id=agent.id, messages=[])
            self.db.add(thread)
            await self.db.flush()

        return await self._persist_exchange(thread, question, answer, attachments)

    async def _run_turn(
        self,
        config: RunConfig,
        question: str,
        history: list[AIMessage | HumanMessage] | None = None,
        handoff: str = "",
        attachments: list[Attachment] | None = None,
        emit: Emit | None = None,
        stop: asyncio.Event | None = None,
    ) -> str:
        attachments = attachments or []
        chat_model = build_chat_model(
            provider=config.llm_model.ai_provider,
            model_name=config.llm_model.model_name,
            temperature=round(config.creativity / 100, 2),
        )

        system_content = config.instructions
        if handoff:
            system_content = f"{system_content}\n\n{_handoff_block(handoff)}"
        context = await self._retrieve_context(
            config.collections, _retrieval_query(question, attachments)
        )
        if context:
            system_content = f"{system_content}\n\n{context}"

        images = [a for a in attachments if a.kind == KIND_IMAGE]

        def build(with_images: bool) -> list:
            # Rebuilt per attempt: _invoke_with_tools appends to the list it is
            # given, so a retry must not reuse the first attempt's messages.
            return [
                SystemMessage(content=system_content),
                *(history or []),
                _human_message(question, attachments, images if with_images else []),
            ]

        streamed = 0

        async def counted(event: dict) -> None:
            nonlocal streamed
            if event["type"] == "token":
                streamed += 1
            await emit(event)

        sink = counted if emit is not None else None

        try:
            answer = await self._invoke_with_tools(
                chat_model, config.mcp_servers, build(with_images=True), sink, stop
            )
        except Exception:
            if not images or streamed:
                raise
            answer = await self._invoke_with_tools(
                chat_model, config.mcp_servers, build(with_images=False), sink, stop
            )

        if not answer and not _stopped(stop):
            raise RuntimeError("The LLM returned an empty response")
        return answer

    # ── Workflow ──────────────────────────────────────────────────────────

    async def _answer_workflow(
        self,
        workflow: Workflow,
        question: str,
        thread_id: str | None,
        attachments: list[Attachment],
    ) -> tuple[str, str] | None:
        thread: Thread | None = None
        history: list[AIMessage | HumanMessage] = []
        if thread_id is not None:
            thread = await self.db.get(Thread, thread_id)
            if thread is None or thread.workflow_id != workflow.id:
                return None
            history = _history_from(thread)

        answer = await self._run_workflow(workflow, question, history, attachments)

        if thread is None:
            thread = Thread(
                type=THREAD_TYPE_WORKFLOW, workflow_id=workflow.id, messages=[]
            )
            self.db.add(thread)
            await self.db.flush()

        return await self._persist_exchange(thread, question, answer, attachments)

    async def _run_workflow(
        self,
        workflow: Workflow,
        question: str,
        history: list[AIMessage | HumanMessage] | None = None,
        attachments: list[Attachment] | None = None,
        emit: Emit | None = None,
        stop: asyncio.Event | None = None,
    ) -> str:
        """Execute the workflow as a LangGraph graph and return the final node's
        output. Every node sees the user's question, the thread history and any
        attachments; the previous node's output rides along as `handoff`."""

        async def run_node(node: Node, node_question: str, handoff: str) -> str:
            if _stopped(stop):
                return handoff
            if emit is not None:
                await emit({"type": "node", "name": _node_label(node)})
            return await self._run_node(
                node, node_question, handoff, history, attachments, emit, stop
            )

        graph = build_workflow_graph(workflow, run_node)
        result = await graph.ainvoke(
            {
                "messages": [HumanMessage(content=question)],
                "question": question,
                "handoff": "",
            }
        )
        answer = latest_text(result["messages"]).strip()
        if _stopped(stop):
            return answer
        return answer or "The workflow produced no output."

    async def _run_node(
        self,
        node: Node,
        question: str,
        handoff: str,
        history: list[AIMessage | HumanMessage] | None = None,
        attachments: list[Attachment] | None = None,
        emit: Emit | None = None,
        stop: asyncio.Event | None = None,
    ) -> str:
        # Condition nodes route inside the graph and never reach this.
        if node.type != NODE_TYPE_AGENT:
            raise ValueError(f"a workflow node of type '{node.type}' cannot be run")
        if node.agent_config is None:
            raise ValueError(
                "a workflow node has no agent set up — open the workflow and configure it"
            )
        config = _config_from_workflow_agent(node.agent_config)
        return await self._run_turn(
            config, question, history, handoff, attachments, emit, stop
        )

    # ── Shared ────────────────────────────────────────────────────────────

    async def _persist_exchange(
        self,
        thread: Thread,
        question: str,
        answer: str,
        attachments: list[Attachment] | None = None,
    ) -> tuple[str, str]:
        attachments = attachments or []
        if thread.title is None:
            thread.title = _thread_title(question, attachments)

        user_message = Message(thread_id=thread.id, is_bot=False, content=question)
        user_message.attachments.extend(attachments)
        thread.messages.append(user_message)

        thread.messages.append(Message(thread_id=thread.id, is_bot=True, content=answer))
        thread.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        return thread.id, answer

    async def _retrieve_context(
        self, collections: list[KbCollection], question: str
    ) -> str:
        if not collections:
            return ""

        cfg = await KbSettingsService(self.db).get_config()
        collection_names = [c.vector_collection_name for c in collections]

        # Embedding + vector search are blocking; run off the event loop.
        docs = await asyncio.to_thread(
            _gather_chunks, cfg, collection_names, question
        )
        if not docs:
            return ""

        formatted = "\n\n".join(
            f"[{i}] {doc.page_content.strip()}" for i, doc in enumerate(docs, start=1)
        )
        return (
            "Use the following knowledge-base context to answer the question when "
            "relevant. If the context is not relevant, rely on your own knowledge.\n\n"
            f"--- CONTEXT ---\n{formatted}\n--- END CONTEXT ---"
        )

    async def _load_tools(self, mcp_servers: list[McpServer]) -> list:
        servers = [s for s in mcp_servers if s.enabled]
        if not servers:
            return []
        connections = {s.name: s.to_connection() for s in servers}
        try:
            return await mcp_client.load_tools(connections)
        except Exception:  # noqa: BLE001 - degrade gracefully if a server is down
            return []

    async def _generate(
        self,
        model,
        messages: list,
        emit: Emit | None,
        stop: asyncio.Event | None,
    ) -> tuple[AIMessage, str]:
        if emit is None:
            response = await model.ainvoke(messages)
            return response, _stringify_content(response.content)

        merged = None
        spoken: list[str] = []
        async for chunk in model.astream(messages):
            if _stopped(stop):
                break
            merged = chunk if merged is None else merged + chunk
            piece = _chunk_text(chunk.content)
            if piece:
                spoken.append(piece)
                await emit({"type": "token", "text": piece})

        if merged is None:
            return AIMessage(content=""), ""
        return merged, "".join(spoken).strip()

    async def _invoke_with_tools(
        self,
        chat_model,
        mcp_servers: list[McpServer],
        messages: list,
        emit: Emit | None = None,
        stop: asyncio.Event | None = None,
    ) -> str:
        tools = await self._load_tools(mcp_servers)
        if not tools:
            _, text = await self._generate(chat_model, messages, emit, stop)
            return text

        tools_by_name = {t.name: t for t in tools}
        if type(chat_model).__name__ == "ChatGoogleGenerativeAI":
            tools = tool_schema.sanitize_for_gemini(tools)
        model = chat_model.bind_tools(tools)

        response, text = await self._generate(model, messages, emit, stop)
        rounds = [text] if text else []
        iterations = 0
        while (
            getattr(response, "tool_calls", None)
            and iterations < MCP_MAX_TOOL_ITERATIONS
            and not _stopped(stop)
        ):
            messages.append(response)
            for call in response.tool_calls:
                tool = tools_by_name.get(call["name"])
                if tool is None:
                    messages.append(
                        ToolMessage(
                            content=f"Error: tool '{call['name']}' is not available.",
                            tool_call_id=call["id"],
                        )
                    )
                    continue
                if emit is not None:
                    await emit({"type": "tool", "name": call["name"]})
                try:
                    tool_msg = await tool.ainvoke(call)
                    tool_msg.content = _stringify_content(tool_msg.content)
                    messages.append(tool_msg)
                except Exception as exc:
                    messages.append(
                        ToolMessage(
                            content=f"Error running tool '{call['name']}': {exc}",
                            tool_call_id=call["id"],
                        )
                    )
            response, text = await self._generate(model, messages, emit, stop)
            if text:
                rounds.append(text)
            iterations += 1

        if emit is not None:
            return "\n\n".join(rounds).strip()
        return text

    async def list_messages(self, thread_id: str) -> list[Message] | None:
        thread = await self.db.get(Thread, thread_id)
        if thread is None:
            return None
        return thread.messages

    async def delete_thread(self, thread_id: str) -> bool:
        """Delete a thread, its messages and their attachments. False if there
        was no such thread."""
        thread = await self.db.get(Thread, thread_id)
        if thread is None:
            return False

        # The rows cascade, the files on disk do not.
        for message in thread.messages:
            for attachment in message.attachments:
                remove_file(attachment.file_path)

        await self.db.delete(thread)
        await self.db.commit()
        return True

    async def list_threads(self, target_id: str) -> list[Thread]:
        """Threads for a chat target, whether it's an agent or a workflow."""
        stmt = (
            select(Thread)
            .where(or_(Thread.agent_id == target_id, Thread.workflow_id == target_id))
            .order_by(Thread.updated_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


def _config_from_agent(agent: Agent) -> RunConfig:
    return RunConfig(
        llm_model=agent.llm_model,
        creativity=agent.creativity,
        instructions=agent.agent_instructions,
        collections=list(agent.collections),
        mcp_servers=list(agent.mcp_servers),
    )


def _config_from_workflow_agent(wa: WorkflowAgent) -> RunConfig:
    """Flatten a workflow agent node onto its optional base agent.

    The base supplies defaults; the node layers on top. Model and creativity are
    overrides (the node's value wins), collections and MCP servers are additive,
    and the instructions concatenate: what the agent is, then what this step
    should do, then how to shape the hand-off."""
    base = wa.agent
    label = wa.name or "an agent node"

    llm_model = wa.llm_model or (base.llm_model if base else None)
    if llm_model is None:
        raise ValueError(
            f"'{label}' has no model — choose one, or an agent to take one from"
        )

    if wa.creativity is not None:
        creativity = wa.creativity
    elif base is not None:
        creativity = base.creativity
    else:
        creativity = DEFAULT_CREATIVITY

    parts = []
    if base is not None:
        parts.append(base.agent_instructions)
    if wa.node_instructions:
        parts.append(wa.node_instructions)
    if wa.output_instructions:
        parts.append(f"Output requirements:\n{wa.output_instructions}")
    instructions = "\n\n".join(p for p in parts if p)
    if not instructions:
        raise ValueError(f"'{label}' has no instructions — add some and save")

    return RunConfig(
        llm_model=llm_model,
        creativity=creativity,
        instructions=instructions,
        collections=_merge_by_id(base.collections if base else [], wa.collections),
        mcp_servers=_merge_by_id(base.mcp_servers if base else [], wa.mcp_servers),
    )


def _merge_by_id(base: list, extra: list) -> list:
    """Base items first, then the node's own, without duplicates."""
    merged = {item.id: item for item in base}
    merged.update({item.id: item for item in extra})
    return list(merged.values())


def _history_from(thread: Thread) -> list[AIMessage | HumanMessage]:
    remaining_images = MAX_HISTORY_IMAGES
    rebuilt: list[AIMessage | HumanMessage] = []

    # Newest first, so the images that survive the budget are the recent ones.
    for message in reversed(thread.messages):
        if message.is_bot:
            rebuilt.append(AIMessage(content=message.content))
            continue

        images = [a for a in message.attachments if a.kind == KIND_IMAGE]
        send = images[:remaining_images]
        remaining_images -= len(send)
        rebuilt.append(_human_message(message.content, message.attachments, send))

    rebuilt.reverse()
    return rebuilt


def _human_message(
    question: str,
    attachments: list[Attachment],
    image_attachments: list[Attachment],
) -> HumanMessage:
    """The user's turn: their text, the text pulled out of their attachments,
    and the images themselves as content blocks."""
    text = _compose_text(question, attachments)

    blocks = []
    for attachment in image_attachments:
        try:
            data = attachment_extract.read_base64(attachment.file_path)
        except OSError:
            # The file is gone from disk — the extracted text still stands in.
            continue
        blocks.append(
            create_image_block(
                base64=data,
                mime_type=attachment_extract.mime_type_for(
                    attachment.filename, attachment.content_type
                ),
            )
        )

    if not blocks:
        return HumanMessage(content=text)
    return HumanMessage(content=[{"type": "text", "text": text}, *blocks])


def _compose_text(question: str, attachments: list[Attachment]) -> str:
    if not attachments:
        return question

    entries = []
    for index, attachment in enumerate(attachments, start=1):
        label = f"[{index}] {attachment.filename}"
        if attachment.status == AttachmentStatus.FAILED.value:
            reason = attachment.error_message or "the file could not be read"
            entries.append(f"{label} — could not be read: {reason}")
            continue

        if attachment.extracted_text:
            if attachment.kind == KIND_IMAGE:
                label += " (image, text below read from it by OCR)"
            entries.append(f"{label}\n{attachment.extracted_text}")
        elif attachment.kind == KIND_IMAGE:
            entries.append(f"{label} (image, no readable text in it)")
        else:
            entries.append(f"{label} — no text could be extracted from this file")

    body = "\n\n".join(entries)
    header = (
        "The user attached the following file(s) to this message. Use their "
        "contents when answering."
    )
    attached = f"{header}\n\n--- ATTACHMENTS ---\n{body}\n--- END ATTACHMENTS ---"
    return f"{question}\n\n{attached}" if question else attached


def _retrieval_query(question: str, attachments: list[Attachment]) -> str:
    if question:
        return question
    for attachment in attachments:
        if attachment.extracted_text:
            return attachment.extracted_text[:RETRIEVAL_QUERY_CHARS]
    return " ".join(a.filename for a in attachments)


def _thread_title(question: str, attachments: list[Attachment]) -> str:
    if question:
        return question[:200]
    if attachments:
        return attachments[0].filename[:200]
    return "New chat"


def _handoff_block(handoff: str) -> str:
    return (
        "The previous step of this workflow produced the output below. Treat it as "
        "context for your own step — do not answer it as if it were the user's "
        "message.\n\n"
        f"--- PREVIOUS STEP OUTPUT ---\n{handoff}\n--- END PREVIOUS STEP OUTPUT ---"
    )


def _stopped(stop: asyncio.Event | None) -> bool:
    return stop is not None and stop.is_set()


def _node_label(node: Node) -> str:
    config = node.agent_config
    if config is None:
        return "Agent"
    if config.name:
        return config.name
    if config.agent is not None:
        return config.agent.name
    return "Agent"


def _chunk_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") in (
                None,
                "text",
                "text_delta",
            ):
                parts.append(block.get("text") or "")
        return "".join(parts)
    return str(content)


def _stringify_content(content) -> str:
    """Flatten message content to text. Providers that return content blocks
    (a list of dicts) would otherwise be stored as a Python repr."""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                parts.append(block.get("text") or "")
            else:
                parts.append(str(block))
        return "\n".join(p for p in parts if p).strip()
    return str(content).strip()


def _gather_chunks(cfg: KbConfig, collection_names: list[str], question: str):
    gathered = []
    for name in collection_names:
        gathered.extend(
            kb_vectorstore.search_collection(
                cfg, name, question, k=RAG_TOP_K_PER_COLLECTION
            )
        )
    return gathered[:RAG_MAX_CHUNKS]

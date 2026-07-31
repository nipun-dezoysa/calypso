import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone

from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.agent_model import Agent
from src.models.kb_collection_model import KbCollection
from src.models.llm_model import LLMModel
from src.models.mcp_server_model import McpServer
from src.models.message_model import Message
from src.models.node_model import NODE_TYPE_AGENT, Node
from src.models.thread_model import THREAD_TYPE_AGENT, THREAD_TYPE_WORKFLOW, Thread
from src.models.workflow_agent_model import WorkflowAgent
from src.models.workflow_model import Workflow
from src.services import kb_vectorstore, mcp_client, tool_schema
from src.services.kb_settings_service import KbSettingsService
from src.services.kb_vectorstore import KbConfig
from src.services.llm_factory import build_chat_model
from src.services.workflow_builder_service import build_workflow_graph, latest_text

RAG_TOP_K_PER_COLLECTION = 4
RAG_MAX_CHUNKS = 8
MCP_MAX_TOOL_ITERATIONS = 6
DEFAULT_CREATIVITY = 50


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
    ) -> tuple[str, str] | None:
        agent = await self.db.get(Agent, target_id)
        if agent is not None:
            return await self._answer_agent(agent, question, thread_id)

        workflow = await self.db.get(Workflow, target_id)
        if workflow is not None:
            return await self._answer_workflow(workflow, question, thread_id)

        return None

    # ── Agent ─────────────────────────────────────────────────────────────

    async def _answer_agent(
        self,
        agent: Agent,
        question: str,
        thread_id: str | None,
    ) -> tuple[str, str] | None:
        thread: Thread | None = None
        history: list[AIMessage | HumanMessage] = []
        if thread_id is not None:
            thread = await self.db.get(Thread, thread_id)
            if thread is None or thread.agent_id != agent.id:
                return None
            history = _history_from(thread)

        answer = await self._run_turn(_config_from_agent(agent), question, history)

        if thread is None:
            thread = Thread(type=THREAD_TYPE_AGENT, agent_id=agent.id, messages=[])
            self.db.add(thread)
            await self.db.flush()

        return await self._persist_exchange(thread, question, answer)

    async def _run_turn(
        self,
        config: RunConfig,
        question: str,
        history: list[AIMessage | HumanMessage] | None = None,
        handoff: str = "",
    ) -> str:
        """Run one turn (LLM + KB context + MCP tools) and return the answer text.
        No persistence — reused by both direct chat and workflow nodes."""
        chat_model = build_chat_model(
            provider=config.llm_model.ai_provider,
            model_name=config.llm_model.model_name,
            temperature=round(config.creativity / 100, 2),
        )

        system_content = config.instructions
        if handoff:
            system_content = f"{system_content}\n\n{_handoff_block(handoff)}"
        context = await self._retrieve_context(config.collections, question)
        if context:
            system_content = f"{system_content}\n\n{context}"

        messages = [
            SystemMessage(content=system_content),
            *(history or []),
            HumanMessage(content=question),
        ]
        answer = await self._invoke_with_tools(chat_model, config.mcp_servers, messages)
        if not answer:
            raise RuntimeError("The LLM returned an empty response")
        return answer

    # ── Workflow ──────────────────────────────────────────────────────────

    async def _answer_workflow(
        self,
        workflow: Workflow,
        question: str,
        thread_id: str | None,
    ) -> tuple[str, str] | None:
        thread: Thread | None = None
        history: list[AIMessage | HumanMessage] = []
        if thread_id is not None:
            thread = await self.db.get(Thread, thread_id)
            if thread is None or thread.workflow_id != workflow.id:
                return None
            history = _history_from(thread)

        answer = await self._run_workflow(workflow, question, history)

        if thread is None:
            thread = Thread(
                type=THREAD_TYPE_WORKFLOW, workflow_id=workflow.id, messages=[]
            )
            self.db.add(thread)
            await self.db.flush()

        return await self._persist_exchange(thread, question, answer)

    async def _run_workflow(
        self,
        workflow: Workflow,
        question: str,
        history: list[AIMessage | HumanMessage] | None = None,
    ) -> str:
        """Execute the workflow as a LangGraph graph and return the final node's
        output. Every node sees the user's question and the thread history; the
        previous node's output rides along as `handoff`."""

        async def run_node(node: Node, node_question: str, handoff: str) -> str:
            return await self._run_node(node, node_question, handoff, history)

        graph = build_workflow_graph(workflow, run_node)
        result = await graph.ainvoke(
            {
                "messages": [HumanMessage(content=question)],
                "question": question,
                "handoff": "",
            }
        )
        answer = latest_text(result["messages"]).strip()
        return answer or "The workflow produced no output."

    async def _run_node(
        self,
        node: Node,
        question: str,
        handoff: str,
        history: list[AIMessage | HumanMessage] | None = None,
    ) -> str:
        # Condition nodes route inside the graph and never reach this.
        if node.type != NODE_TYPE_AGENT:
            raise ValueError(f"a workflow node of type '{node.type}' cannot be run")
        if node.agent_config is None:
            raise ValueError(
                "a workflow node has no agent set up — open the workflow and configure it"
            )
        config = _config_from_workflow_agent(node.agent_config)
        return await self._run_turn(config, question, history, handoff)

    # ── Shared ────────────────────────────────────────────────────────────

    async def _persist_exchange(
        self, thread: Thread, question: str, answer: str
    ) -> tuple[str, str]:
        if thread.title is None:
            thread.title = question.strip()[:200]
        thread.messages.append(Message(thread_id=thread.id, is_bot=False, content=question))
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

    async def _invoke_with_tools(
        self,
        chat_model,
        mcp_servers: list[McpServer],
        messages: list,
    ) -> str:
        tools = await self._load_tools(mcp_servers)
        if not tools:
            response = await chat_model.ainvoke(messages)
            return _stringify_content(response.content)

        tools_by_name = {t.name: t for t in tools}
        if type(chat_model).__name__ == "ChatGoogleGenerativeAI":
            tools = tool_schema.sanitize_for_gemini(tools)
        model = chat_model.bind_tools(tools)

        response = await model.ainvoke(messages)
        iterations = 0
        while getattr(response, "tool_calls", None) and iterations < MCP_MAX_TOOL_ITERATIONS:
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
            response = await model.ainvoke(messages)
            iterations += 1

        return _stringify_content(response.content)

    async def list_messages(self, thread_id: str) -> list[Message] | None:
        thread = await self.db.get(Thread, thread_id)
        if thread is None:
            return None
        return thread.messages

    async def delete_thread(self, thread_id: str) -> bool:
        """Delete a thread and its messages. False if there was no such thread."""
        thread = await self.db.get(Thread, thread_id)
        if thread is None:
            return False
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
    return [
        AIMessage(content=m.content) if m.is_bot else HumanMessage(content=m.content)
        for m in thread.messages
    ]


def _handoff_block(handoff: str) -> str:
    return (
        "The previous step of this workflow produced the output below. Treat it as "
        "context for your own step — do not answer it as if it were the user's "
        "message.\n\n"
        f"--- PREVIOUS STEP OUTPUT ---\n{handoff}\n--- END PREVIOUS STEP OUTPUT ---"
    )


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

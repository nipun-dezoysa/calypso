import asyncio
from datetime import datetime, timezone

from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.agent_model import Agent
from src.models.message_model import Message
from src.models.thread_model import Thread
from src.services import kb_vectorstore, mcp_client
from src.services.kb_settings_service import KbSettingsService
from src.services.kb_vectorstore import KbConfig
from src.services.llm_factory import build_chat_model

RAG_TOP_K_PER_COLLECTION = 4
RAG_MAX_CHUNKS = 8
MCP_MAX_TOOL_ITERATIONS = 6

class ChatService:
    """Answers a question by invoking an Agent's configured LLM provider/model,
    persisting the exchange to a Thread's message history."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def answer_question(
        self,
        agent_id: str,
        question: str,
        thread_id: str | None = None,
    ) -> tuple[str, str] | None:
        """Returns (thread_id, answer). None if the agent or thread isn't found."""
        agent = await self.db.get(Agent, agent_id)
        if agent is None:
            return None

        # Don't create the thread (or any other write) before the LLM call:
        thread: Thread | None = None
        chat_history: list[AIMessage | HumanMessage] = []
        if thread_id is not None:
            thread = await self.db.get(Thread, thread_id)
            if thread is None or thread.agent_id != agent_id:
                return None
            chat_history = [
                AIMessage(content=m.content) if m.is_bot else HumanMessage(content=m.content)
                for m in thread.messages
            ]

        provider = agent.llm_model.ai_provider
        temperature = round(agent.creativity / 100, 2)
        chat_model = build_chat_model(
            provider=provider,
            model_name=agent.llm_model.model_name,
            temperature=temperature,
        )

        system_content = agent.agent_instructions
        context = await self._retrieve_context(agent, question)
        if context:
            system_content = f"{system_content}\n\n{context}"

        messages = [
            SystemMessage(content=system_content),
            *chat_history,
            HumanMessage(content=question),
        ]
        answer = await self._invoke_with_tools(chat_model, agent, messages)
        if not answer:
            raise RuntimeError("The LLM returned an empty response")

        if thread is None:
            thread = Thread(agent_id=agent_id, messages=[])
            self.db.add(thread)
            await self.db.flush()

        if thread.title is None:
            thread.title = question.strip()[:200]
        thread.messages.append(Message(thread_id=thread.id, is_bot=False, content=question))
        thread.messages.append(Message(thread_id=thread.id, is_bot=True, content=answer))
        thread.updated_at = datetime.now(timezone.utc)
        await self.db.commit()

        return thread.id, answer

    async def _retrieve_context(self, agent: Agent, question: str) -> str:
        collections = list(agent.collections)
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

    async def _load_tools(self, agent: Agent) -> list:
        servers = [s for s in agent.mcp_servers if s.enabled]
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
        agent: Agent,
        messages: list,
    ) -> str:
        tools = await self._load_tools(agent)
        if not tools:
            response = await chat_model.ainvoke(messages)
            return str(response.content).strip()

        model = chat_model.bind_tools(tools)
        tools_by_name = {t.name: t for t in tools}

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
                    tool_msg.content = _stringify_tool_content(tool_msg.content)
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

        return str(response.content).strip()

    async def list_messages(self, thread_id: str) -> list[Message] | None:
        thread = await self.db.get(Thread, thread_id)
        if thread is None:
            return None
        return thread.messages

    async def list_threads(self, agent_id: str) -> list[Thread]:
        stmt = (
            select(Thread)
            .where(Thread.agent_id == agent_id)
            .order_by(Thread.updated_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


def _stringify_tool_content(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                parts.append(block.get("text") or "")
            else:
                parts.append(str(block))
        return "\n".join(p for p in parts if p)
    return str(content)


def _gather_chunks(cfg: KbConfig, collection_names: list[str], question: str):
    gathered = []
    for name in collection_names:
        gathered.extend(
            kb_vectorstore.search_collection(
                cfg, name, question, k=RAG_TOP_K_PER_COLLECTION
            )
        )
    return gathered[:RAG_MAX_CHUNKS]

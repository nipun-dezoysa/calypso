from datetime import datetime, timezone

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.agent_model import Agent
from src.models.message_model import Message
from src.models.thread_model import Thread
from src.services.llm_factory import build_chat_model


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

        messages = [
            SystemMessage(content=agent.agent_instructions),
            *chat_history,
            HumanMessage(content=question),
        ]
        response = await chat_model.ainvoke(messages)
        answer = str(response.content).strip()
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

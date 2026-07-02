from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.agent_model import Agent
from src.models.llm_model import LLMModel
from src.schemas.agent_schema import AgentCreate, AgentUpdate


class AgentService:
    """Service layer handling all agent database operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, data: AgentCreate) -> Agent:
        """Create a new agent."""
        agent = Agent(
            name=data.name,
            llm_model_id=data.llm_model_id,
            agent_instructions=data.agent_instructions,
            creativity=data.creativity,
        )
        self.db.add(agent)
        await self.db.commit()
        await self.db.refresh(agent)
        return agent

    async def get_by_id(self, agent_id: str) -> Agent | None:
        """Get an agent by its ID."""
        return await self.db.get(Agent, agent_id)

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Agent]:
        """Get all agents with pagination."""
        stmt = (
            select(Agent)
            .order_by(Agent.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update(
        self,
        agent_id: str,
        data: AgentUpdate,
    ) -> Agent | None:
        """Update an existing agent. Returns None if not found."""
        agent = await self.get_by_id(agent_id)
        if agent is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(agent, field, value)

        await self.db.commit()
        await self.db.refresh(agent)
        return agent

    async def delete(self, agent_id: str) -> bool:
        """Delete an agent. Returns True if deleted, False if not found."""
        agent = await self.get_by_id(agent_id)
        if agent is None:
            return False

        await self.db.delete(agent)
        await self.db.commit()
        return True

    async def get_by_name(self, name: str) -> Agent | None:
        """Get an agent by its name."""
        stmt = select(Agent).where(Agent.name == name)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_llm_model(self, llm_model_id: str) -> LLMModel | None:
        """Get an LLMModel by its ID, used to validate agent.llm_model_id."""
        return await self.db.get(LLMModel, llm_model_id)

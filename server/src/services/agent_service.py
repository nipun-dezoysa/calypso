from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.agent_model import Agent
from src.models.kb_collection_model import KbCollection
from src.models.llm_model import LLMModel
from src.models.mcp_server_model import McpServer
from src.schemas.agent_schema import AgentCreate, AgentUpdate


class AgentService:
    """Service layer handling all agent database operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, data: AgentCreate) -> Agent:
        """Create a new agent."""
        collections = await self._resolve_collections(data.collection_ids)
        mcp_servers = await self._resolve_mcp_servers(data.mcp_server_ids)
        agent = Agent(
            name=data.name,
            llm_model_id=data.llm_model_id,
            agent_instructions=data.agent_instructions,
            creativity=data.creativity,
            markdown_enabled=data.markdown_enabled,
            collections=collections,
            mcp_servers=mcp_servers,
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

        # Attached collections/servers are set through relationships, not setattr.
        if "collection_ids" in update_data:
            collection_ids = update_data.pop("collection_ids") or []
            agent.collections = await self._resolve_collections(collection_ids)

        if "mcp_server_ids" in update_data:
            mcp_server_ids = update_data.pop("mcp_server_ids") or []
            agent.mcp_servers = await self._resolve_mcp_servers(mcp_server_ids)

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

    async def missing_collection_ids(self, collection_ids: list[str]) -> list[str]:
        """Return the subset of ids that don't correspond to a collection."""
        unique = list(dict.fromkeys(collection_ids))
        if not unique:
            return []
        stmt = select(KbCollection.id).where(KbCollection.id.in_(unique))
        result = await self.db.execute(stmt)
        found = set(result.scalars().all())
        return [cid for cid in unique if cid not in found]

    async def _resolve_collections(self, collection_ids: list[str]) -> list[KbCollection]:
        """Fetch collection rows for the given ids, deduplicated and preserving
        order. Raises ValueError if any id is unknown."""
        unique = list(dict.fromkeys(collection_ids))
        if not unique:
            return []
        stmt = select(KbCollection).where(KbCollection.id.in_(unique))
        result = await self.db.execute(stmt)
        by_id = {c.id: c for c in result.scalars().all()}
        missing = [cid for cid in unique if cid not in by_id]
        if missing:
            raise ValueError(f"Collections not found: {missing}")
        return [by_id[cid] for cid in unique]

    async def missing_mcp_server_ids(self, mcp_server_ids: list[str]) -> list[str]:
        """Return the subset of ids that don't correspond to an MCP server."""
        unique = list(dict.fromkeys(mcp_server_ids))
        if not unique:
            return []
        stmt = select(McpServer.id).where(McpServer.id.in_(unique))
        result = await self.db.execute(stmt)
        found = set(result.scalars().all())
        return [sid for sid in unique if sid not in found]

    async def _resolve_mcp_servers(self, mcp_server_ids: list[str]) -> list[McpServer]:
        """Fetch MCP server rows for the given ids, deduplicated and preserving
        order. Raises ValueError if any id is unknown."""
        unique = list(dict.fromkeys(mcp_server_ids))
        if not unique:
            return []
        stmt = select(McpServer).where(McpServer.id.in_(unique))
        result = await self.db.execute(stmt)
        by_id = {s.id: s for s in result.scalars().all()}
        missing = [sid for sid in unique if sid not in by_id]
        if missing:
            raise ValueError(f"MCP servers not found: {missing}")
        return [by_id[sid] for sid in unique]

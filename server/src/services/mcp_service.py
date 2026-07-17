from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.mcp_server_model import McpServer
from src.schemas.mcp_schema import McpServerCreate, McpServerUpdate, McpTestResult
from src.services import mcp_client


class McpService:
    """Service layer for MCP server CRUD and connection testing."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, data: McpServerCreate) -> McpServer:
        server = McpServer(
            name=data.name,
            transport=data.transport,
            command=data.command,
            args=data.args,
            env=data.env,
            cwd=data.cwd,
            url=data.url,
            headers=data.headers,
            enabled=data.enabled,
            description=data.description,
        )
        self.db.add(server)
        await self.db.commit()
        await self.db.refresh(server)
        return server

    async def get_by_id(self, server_id: str) -> McpServer | None:
        return await self.db.get(McpServer, server_id)

    async def get_by_name(self, name: str) -> McpServer | None:
        stmt = select(McpServer).where(McpServer.name == name)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 100) -> list[McpServer]:
        stmt = (
            select(McpServer)
            .order_by(McpServer.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update(self, server_id: str, data: McpServerUpdate) -> McpServer | None:
        server = await self.get_by_id(server_id)
        if server is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(server, field, value)

        await self.db.commit()
        await self.db.refresh(server)
        return server

    async def delete(self, server_id: str) -> bool:
        server = await self.get_by_id(server_id)
        if server is None:
            return False
        await self.db.delete(server)
        await self.db.commit()
        return True

    async def test_connection(self, server: McpServer) -> McpTestResult:
        try:
            tools = await mcp_client.fetch_tools(server.name, server.to_connection())
        except Exception as exc: 
            return McpTestResult(ok=False, error=str(exc)[:1000])

        return McpTestResult(
            ok=True,
            tool_count=len(tools),
            tools=[{"name": n, "description": d} for n, d in tools],
        )

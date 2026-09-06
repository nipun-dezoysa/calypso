from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.graph_db_model import GraphDatabase
from src.schemas.graph_db_schema import (
    GraphDbCreate,
    GraphDbTestResult,
    GraphDbUpdate,
    GraphSchemaInfo,
)
from src.services import graph_client
from src.services.graph_client import GraphConnection, GraphError


class GraphDbService:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, data: GraphDbCreate) -> GraphDatabase:
        graph_db = GraphDatabase(
            name=data.name,
            provider=data.provider,
            uri=data.uri,
            username=data.username,
            password=data.password,
            database=data.database,
            read_only=data.read_only,
            query_timeout=data.query_timeout,
            max_rows=data.max_rows,
            enabled=data.enabled,
            description=data.description,
        )
        self.db.add(graph_db)
        await self.db.commit()
        await self.db.refresh(graph_db)
        return graph_db

    async def get_by_id(self, graph_db_id: str) -> GraphDatabase | None:
        return await self.db.get(GraphDatabase, graph_db_id)

    async def get_by_name(self, name: str) -> GraphDatabase | None:
        stmt = select(GraphDatabase).where(GraphDatabase.name == name)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 100) -> list[GraphDatabase]:
        stmt = (
            select(GraphDatabase)
            .order_by(GraphDatabase.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update(
        self, graph_db_id: str, data: GraphDbUpdate
    ) -> GraphDatabase | None:
        graph_db = await self.get_by_id(graph_db_id)
        if graph_db is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(graph_db, field, value)

        await self.db.commit()
        await self.db.refresh(graph_db)
        await graph_client.evict(graph_db_id)
        return graph_db

    async def delete(self, graph_db_id: str) -> bool:
        graph_db = await self.get_by_id(graph_db_id)
        if graph_db is None:
            return False
        await self.db.delete(graph_db)
        await self.db.commit()
        await graph_client.evict(graph_db_id)
        return True

    async def test_connection(self, graph_db: GraphDatabase) -> GraphDbTestResult:
        conn = GraphConnection.from_dict(graph_db.to_connection())
        try:
            await graph_client.verify(graph_db.id, conn)
            schema = await graph_client.fetch_schema(graph_db.id, conn)
        except GraphError as exc:
            return GraphDbTestResult(ok=False, error=str(exc))
        except Exception as exc:  # noqa: BLE001 - shown to the user as text
            return GraphDbTestResult(ok=False, error=str(exc)[:1000])

        return GraphDbTestResult(
            ok=True,
            node_label_count=len(schema["nodes"]),
            relationship_type_count=len(schema["relationships"]),
            graph_schema=GraphSchemaInfo.model_validate(schema),
        )

    async def fetch_schema(self, graph_db: GraphDatabase) -> GraphSchemaInfo:
        conn = GraphConnection.from_dict(graph_db.to_connection())
        await graph_client.verify(graph_db.id, conn)
        schema = await graph_client.fetch_schema(graph_db.id, conn)
        return GraphSchemaInfo.model_validate(schema)

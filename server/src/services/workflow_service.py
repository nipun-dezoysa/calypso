import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.edge_model import Edge
from src.models.node_model import Node
from src.models.workflow_model import Workflow
from src.schemas.workflow_schema import WorkflowCreate, WorkflowReplace


class WorkflowService:
    """CRUD for workflows plus whole-graph replacement (the canvas 'save')."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, data: WorkflowCreate) -> Workflow:
        wf = Workflow(name=data.name)
        self.db.add(wf)
        await self.db.flush()

        for n in data.nodes:
            self.db.add(_node_from_input(wf.id, n))
        await self.db.flush()
        for e in data.edges:
            self.db.add(_edge_from_input(wf.id, e))

        await self.db.commit()
        await self.db.refresh(wf, attribute_names=["nodes", "edges"])
        return wf

    async def get(self, workflow_id: str) -> Workflow | None:
        return await self.db.get(Workflow, workflow_id)

    async def list(self, skip: int = 0, limit: int = 100) -> list[Workflow]:
        stmt = (
            select(Workflow)
            .order_by(Workflow.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def replace(self, workflow_id: str, data: WorkflowReplace) -> Workflow | None:
        wf = await self.get(workflow_id)
        if wf is None:
            return None

        wf.name = data.name

        # Rebuild edges from scratch (cheap, no stable identity to preserve).
        for e in list(wf.edges):
            await self.db.delete(e)

        # Diff nodes by id: update in place, delete removed, insert new.
        existing = {n.id: n for n in wf.nodes}
        incoming_ids = {n.id for n in data.nodes}
        for nid, node in list(existing.items()):
            if nid not in incoming_ids:
                await self.db.delete(node)
        for nin in data.nodes:
            node = existing.get(nin.id)
            if node is not None:
                node.type = nin.type
                node.i_id = nin.i_id
                node.is_start = nin.is_start
                node.position_x = nin.position_x
                node.position_y = nin.position_y
            else:
                self.db.add(_node_from_input(workflow_id, nin))
        await self.db.flush()

        # Fresh ids for the rebuilt edges — avoids any collision with the edges
        # just deleted above.
        for ein in data.edges:
            self.db.add(
                Edge(
                    id=str(uuid.uuid4()),
                    w_id=workflow_id,
                    source=ein.source,
                    target=ein.target,
                )
            )

        await self.db.commit()
        await self.db.refresh(wf, attribute_names=["nodes", "edges"])
        return wf

    async def delete(self, workflow_id: str) -> bool:
        wf = await self.get(workflow_id)
        if wf is None:
            return False
        await self.db.delete(wf)
        await self.db.commit()
        return True


def _node_from_input(workflow_id: str, n) -> Node:
    return Node(
        id=n.id,
        w_id=workflow_id,
        type=n.type,
        i_id=n.i_id,
        is_start=n.is_start,
        position_x=n.position_x,
        position_y=n.position_y,
    )


def _edge_from_input(workflow_id: str, e) -> Edge:
    return Edge(
        id=e.id or str(uuid.uuid4()),
        w_id=workflow_id,
        source=e.source,
        target=e.target,
    )

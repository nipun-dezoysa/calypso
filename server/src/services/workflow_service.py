import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.condition_model import Condition
from src.models.edge_model import Edge
from src.models.node_model import Node
from src.models.workflow_model import Workflow
from src.schemas.workflow_schema import WorkflowCreate, WorkflowReplace

_GRAPH_ATTRS = ["nodes", "edges", "conditions"]


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
        for c in data.conditions:
            self.db.add(_condition_from_input(wf.id, c))
        await self.db.flush()
        for e in data.edges:
            self.db.add(_edge_from_input(wf.id, e))

        await self.db.commit()
        await self.db.refresh(wf, attribute_names=_GRAPH_ATTRS)
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

        # Drop removed branches before their nodes go, so this is the only DELETE
        # they get (a node deletion would otherwise cascade onto them as well).
        existing_conditions = {c.id: c for c in wf.conditions}
        incoming_condition_ids = {c.id for c in data.conditions}
        for cid, cond in list(existing_conditions.items()):
            if cid not in incoming_condition_ids:
                await self.db.delete(cond)
        await self.db.flush()

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

        # Surviving branches are updated in place rather than rebuilt: the edges
        # below point at their ids via `source_handle`, so those ids have to
        # survive the save.
        for cin in data.conditions:
            cond = existing_conditions.get(cin.id)
            if cond is not None:
                cond.n_id = cin.n_id
                cond.label = cin.label
                cond.operator = cin.operator
                cond.value = cin.value
                cond.case_sensitive = cin.case_sensitive
                cond.order_index = cin.order_index
            else:
                self.db.add(_condition_from_input(workflow_id, cin))
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
                    source_handle=ein.source_handle,
                )
            )

        await self.db.commit()
        await self.db.refresh(wf, attribute_names=_GRAPH_ATTRS)
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


def _condition_from_input(workflow_id: str, c) -> Condition:
    return Condition(
        id=c.id,
        w_id=workflow_id,
        n_id=c.n_id,
        label=c.label,
        operator=c.operator,
        value=c.value,
        case_sensitive=c.case_sensitive,
        order_index=c.order_index,
    )


def _edge_from_input(workflow_id: str, e) -> Edge:
    return Edge(
        id=e.id or str(uuid.uuid4()),
        w_id=workflow_id,
        source=e.source,
        target=e.target,
        source_handle=e.source_handle,
    )

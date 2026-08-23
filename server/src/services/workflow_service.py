import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.agent_model import Agent
from src.models.condition_model import Condition
from src.models.edge_model import Edge
from src.models.kb_collection_model import KbCollection
from src.models.llm_model import LLMModel
from src.models.mcp_server_model import McpServer
from src.models.node_model import Node
from src.models.workflow_agent_model import WorkflowAgent
from src.models.workflow_model import Workflow
from src.schemas.workflow_schema import (
    AgentNodeInput,
    WorkflowCreate,
    WorkflowReplace,
)

_GRAPH_ATTRS = ["nodes", "edges", "conditions", "agent_nodes"]


class WorkflowService:
    """CRUD for workflows plus whole-graph replacement (the canvas 'save')."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, data: WorkflowCreate) -> Workflow:
        refs = await self._resolve_refs(data.agent_nodes)

        wf = Workflow(name=data.name)
        self.db.add(wf)
        await self.db.flush()

        for n in data.nodes:
            self.db.add(_node_from_input(wf.id, n))
        await self.db.flush()
        for c in data.conditions:
            self.db.add(_condition_from_input(wf.id, c))
        for a in data.agent_nodes:
            self.db.add(refs.build(wf.id, a))
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

        refs = await self._resolve_refs(data.agent_nodes)
        wf.name = data.name

        # Rebuild edges from scratch (cheap, no stable identity to preserve).
        for e in list(wf.edges):
            await self.db.delete(e)

        # Drop removed branches and agent configs before their nodes go, so this
        # is the only DELETE they get (a node deletion would otherwise cascade
        # onto them as well).
        existing_conditions = {c.id: c for c in wf.conditions}
        incoming_condition_ids = {c.id for c in data.conditions}
        for cid, cond in list(existing_conditions.items()):
            if cid not in incoming_condition_ids:
                await self.db.delete(cond)

        existing_agents = {a.id: a for a in wf.agent_nodes}
        incoming_agent_ids = {a.id for a in data.agent_nodes}
        for aid, wa in list(existing_agents.items()):
            if aid not in incoming_agent_ids:
                await self.db.delete(wa)
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

        # Agent configs are diffed too, so a node keeps its identity (and its
        # attached collections/servers) across a save.
        for ain in data.agent_nodes:
            wa = existing_agents.get(ain.id)
            if wa is not None:
                refs.apply(wa, ain)
            else:
                self.db.add(refs.build(workflow_id, ain))
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

    # Annotations below are quoted: `list` is shadowed by this class's own
    # `list()` method by the time these definitions are evaluated.
    async def _resolve_refs(self, agent_nodes: "list[AgentNodeInput]") -> "_AgentRefs":
        """Load every agent / model / collection / MCP server the agent nodes
        point at, in one pass, and fail loudly on ids that no longer exist —
        a stale canvas should get a clear error rather than a silently
        half-configured node."""
        refs = _AgentRefs(
            agents=await self._load_by_id(Agent, {a.agent_id for a in agent_nodes}, "Agents"),
            models=await self._load_by_id(
                LLMModel, {a.llm_model_id for a in agent_nodes}, "Models"
            ),
            collections=await self._load_by_id(
                KbCollection,
                {cid for a in agent_nodes for cid in a.collection_ids},
                "Collections",
            ),
            servers=await self._load_by_id(
                McpServer,
                {sid for a in agent_nodes for sid in a.mcp_server_ids},
                "MCP servers",
            ),
        )
        return refs

    async def _load_by_id(self, model, ids: set[str | None], label: str) -> dict:
        wanted = {i for i in ids if i}
        if not wanted:
            return {}
        result = await self.db.execute(select(model).where(model.id.in_(wanted)))
        by_id = {row.id: row for row in result.scalars().all()}
        missing = sorted(wanted - by_id.keys())
        if missing:
            raise ValueError(f"{label} not found: {', '.join(missing)}")
        return by_id

    async def rename(self, workflow_id: str, name: str) -> Workflow | None:
        wf = await self.get(workflow_id)
        if wf is None:
            return None
        wf.name = name
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


@dataclass
class _AgentRefs:
    """The rows an agent-node payload refers to, pre-loaded and keyed by id."""

    agents: dict
    models: dict
    collections: dict
    servers: dict

    def apply(self, wa: WorkflowAgent, a: AgentNodeInput) -> WorkflowAgent:
        wa.n_id = a.n_id
        wa.name = a.name
        wa.agent_id = a.agent_id
        wa.llm_model_id = a.llm_model_id
        wa.node_instructions = a.node_instructions
        wa.output_instructions = a.output_instructions
        wa.creativity = a.creativity
        wa.markdown_enabled = a.markdown_enabled
        wa.collections = [self.collections[cid] for cid in a.collection_ids]
        wa.mcp_servers = [self.servers[sid] for sid in a.mcp_server_ids]
        return wa

    def build(self, workflow_id: str, a: AgentNodeInput) -> WorkflowAgent:
        return self.apply(WorkflowAgent(id=a.id, w_id=workflow_id), a)


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

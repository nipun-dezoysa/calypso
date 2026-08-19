import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from src.models.condition_model import (
    CONDITION_OPERATORS,
    VALUELESS_OPERATORS,
)
from src.models.node_model import NODE_TYPE_AGENT, NODE_TYPE_CONDITION, NODE_TYPES


class AgentNodeInput(BaseModel):
    """The workflow-scoped agent behind one agent node. `id` is client-generated
    so the canvas keeps a stable identity across saves."""

    id: str = Field(..., min_length=1)
    n_id: str = Field(..., min_length=1, description="Id of the agent node")
    name: str = Field(default="", max_length=100)
    agent_id: str | None = Field(
        default=None,
        description="Optional existing agent used as this node's base",
    )
    llm_model_id: str | None = Field(
        default=None,
        description="Model override; falls back to the base agent's model",
    )
    node_instructions: str = Field(default="", description="What this step should do")
    output_instructions: str = Field(
        default="",
        description="How this step should shape what it hands to the next node",
    )
    creativity: int | None = Field(default=None, ge=0, le=100)
    markdown_enabled: bool | None = Field(
        default=None,
        description="Markdown-formatting override; null inherits the base agent's setting",
    )
    collection_ids: list[str] = Field(default_factory=list)
    mcp_server_ids: list[str] = Field(default_factory=list)

    @field_validator("name", "node_instructions", "output_instructions")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("agent_id", "llm_model_id")
    @classmethod
    def blank_to_none(cls, v: str | None) -> str | None:
        return v or None

    @field_validator("collection_ids", "mcp_server_ids")
    @classmethod
    def dedupe(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(v))

    @model_validator(mode="after")
    def check_runnable(self) -> "AgentNodeInput":
        # Without a base agent to inherit from, the node has to name its own
        # model — otherwise there is nothing to call at run time.
        if not self.agent_id and not self.llm_model_id:
            raise ValueError(
                "an agent node needs a model, or an agent to take one from"
            )
        if not self.agent_id and not self.node_instructions:
            raise ValueError(
                "an agent node needs instructions, or an agent to take them from"
            )
        return self


class NodeInput(BaseModel):
    """A node as submitted by the client. `id` is client-generated so edges can
    reference it in the same payload."""

    id: str = Field(..., min_length=1)
    type: str = Field(default=NODE_TYPE_AGENT)
    i_id: str | None = Field(default=None, description="Wrapped instance id (e.g. agent id)")
    is_start: bool = Field(default=False)
    position_x: float = Field(default=0.0)
    position_y: float = Field(default=0.0)

    @field_validator("type")
    @classmethod
    def normalize_type(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in NODE_TYPES:
            raise ValueError(f"node type must be one of {sorted(NODE_TYPES)}")
        return v

    @model_validator(mode="after")
    def clear_instance_for_condition(self) -> "NodeInput":
        # A condition node wraps no component; its config lives in `conditions`.
        if self.type == NODE_TYPE_CONDITION:
            self.i_id = None
        return self


class ConditionInput(BaseModel):
    """One branch of a condition node. `id` is client-generated so an edge can
    name it as its `source_handle` in the same payload."""

    id: str = Field(..., min_length=1)
    n_id: str = Field(..., min_length=1, description="Id of the condition node")
    label: str = Field(default="", max_length=100)
    operator: str = Field(default="contains")
    value: str | None = Field(default=None, max_length=500)
    case_sensitive: bool = Field(default=False)
    order_index: int = Field(default=0, ge=0)

    @field_validator("operator")
    @classmethod
    def normalize_operator(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in CONDITION_OPERATORS:
            raise ValueError(f"operator must be one of {sorted(CONDITION_OPERATORS)}")
        return v

    @model_validator(mode="after")
    def check_value(self) -> "ConditionInput":
        if self.operator in VALUELESS_OPERATORS:
            self.value = None
            return self
        if not (self.value or "").strip():
            raise ValueError(f"a '{self.operator}' branch needs a value to match against")
        if self.operator == "regex":
            try:
                re.compile(self.value)
            except re.error as exc:
                raise ValueError(f"invalid regular expression: {exc}") from exc
        return self


class EdgeInput(BaseModel):
    id: str | None = Field(default=None)
    source: str = Field(..., min_length=1)
    target: str = Field(..., min_length=1)
    source_handle: str | None = Field(
        default=None,
        description="Branch id this edge leaves from, for condition-node sources",
    )


def validate_graph(
    nodes: list[NodeInput],
    edges: list[EdgeInput],
    conditions: list[ConditionInput],
    agent_nodes: list[AgentNodeInput],
) -> None:
    """Enforce the workflow graph rules. Raises ValueError on the first breach."""
    ids = [n.id for n in nodes]
    if len(ids) != len(set(ids)):
        raise ValueError("node ids must be unique")
    id_set = set(ids)
    condition_node_ids = {n.id for n in nodes if n.type == NODE_TYPE_CONDITION}
    agent_node_ids = {n.id for n in nodes if n.type == NODE_TYPE_AGENT}

    agent_ids = [a.id for a in agent_nodes]
    if len(agent_ids) != len(set(agent_ids)):
        raise ValueError("agent node ids must be unique")

    configured: set[str] = set()
    for a in agent_nodes:
        if a.n_id not in id_set:
            raise ValueError("an agent config references a node that is not in the workflow")
        if a.n_id not in agent_node_ids:
            raise ValueError("only agent nodes can have an agent config")
        if a.n_id in configured:
            raise ValueError("an agent node can only have one agent config")
        configured.add(a.n_id)

    if agent_node_ids - configured:
        raise ValueError("every agent node must have an agent config")

    start_count = sum(1 for n in nodes if n.is_start)
    if start_count > 1:
        raise ValueError("a workflow can have only one start node")
    if nodes and start_count == 0:
        raise ValueError("a workflow must have a start node")

    branch_ids = [c.id for c in conditions]
    if len(branch_ids) != len(set(branch_ids)):
        raise ValueError("condition branch ids must be unique")

    branches_by_node: dict[str, list[ConditionInput]] = {}
    for c in conditions:
        if c.n_id not in id_set:
            raise ValueError("a condition branch references a node that is not in the workflow")
        if c.n_id not in condition_node_ids:
            raise ValueError("only condition nodes can have branches")
        branches_by_node.setdefault(c.n_id, []).append(c)

    for nid in condition_node_ids:
        if not branches_by_node.get(nid):
            raise ValueError("a condition node must have at least one branch")

    branch_owner = {c.id: c.n_id for c in conditions}

    # A pair of nodes may be wired together in one direction only. Two branches of
    # the same condition node may each reach the same target, though — that is
    # still one direction, just two ways of getting there.
    seen: set[tuple[str, str | None, str]] = set()
    direction: dict[frozenset[str], str] = {}
    for e in edges:
        if e.source == e.target:
            raise ValueError("a node cannot connect to itself")
        if e.source not in id_set or e.target not in id_set:
            raise ValueError("an edge references a node that is not in the workflow")

        if e.source in condition_node_ids:
            if not e.source_handle:
                raise ValueError("an edge out of a condition node must leave from a branch")
            if branch_owner.get(e.source_handle) != e.source:
                raise ValueError("an edge references a branch of a different node")
        else:
            e.source_handle = None

        key = (e.source, e.source_handle, e.target)
        if key in seen:
            raise ValueError("this outlet is already connected to that node")
        seen.add(key)

        pair = frozenset((e.source, e.target))
        if direction.setdefault(pair, e.source) != e.source:
            raise ValueError("only one connection is allowed between two nodes")


class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["My Workflow"])
    nodes: list[NodeInput] = Field(default_factory=list)
    edges: list[EdgeInput] = Field(default_factory=list)
    conditions: list[ConditionInput] = Field(default_factory=list)
    agent_nodes: list[AgentNodeInput] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty or whitespace")
        return v

    @model_validator(mode="after")
    def check_graph(self) -> "WorkflowCreate":
        validate_graph(self.nodes, self.edges, self.conditions, self.agent_nodes)
        return self


class WorkflowReplace(BaseModel):
    """Full replacement of a workflow's name and graph (the canvas 'save')."""

    name: str = Field(..., min_length=1, max_length=100)
    nodes: list[NodeInput] = Field(default_factory=list)
    edges: list[EdgeInput] = Field(default_factory=list)
    conditions: list[ConditionInput] = Field(default_factory=list)
    agent_nodes: list[AgentNodeInput] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty or whitespace")
        return v

    @model_validator(mode="after")
    def check_graph(self) -> "WorkflowReplace":
        validate_graph(self.nodes, self.edges, self.conditions, self.agent_nodes)
        return self


class WorkflowRename(BaseModel):
    """Name-only update — the sidebar's rename action, which shouldn't have
    to round-trip the whole graph just to change a label."""

    name: str = Field(..., min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty or whitespace")
        return v


class NodeResponse(BaseModel):
    id: str
    type: str
    i_id: str | None
    is_start: bool
    position_x: float
    position_y: float

    model_config = {"from_attributes": True}


class EdgeResponse(BaseModel):
    id: str
    source: str
    target: str
    source_handle: str | None

    model_config = {"from_attributes": True}


class ConditionResponse(BaseModel):
    id: str
    n_id: str
    label: str
    operator: str
    value: str | None
    case_sensitive: bool
    order_index: int

    model_config = {"from_attributes": True}


class AgentNodeResponse(BaseModel):
    id: str
    n_id: str
    name: str
    agent_id: str | None
    llm_model_id: str | None
    node_instructions: str
    output_instructions: str
    creativity: int | None
    markdown_enabled: bool | None
    collection_ids: list[str]
    mcp_server_ids: list[str]

    @classmethod
    def from_model(cls, wa) -> "AgentNodeResponse":
        return cls(
            id=wa.id,
            n_id=wa.n_id,
            name=wa.name,
            agent_id=wa.agent_id,
            llm_model_id=wa.llm_model_id,
            node_instructions=wa.node_instructions,
            output_instructions=wa.output_instructions,
            creativity=wa.creativity,
            markdown_enabled=wa.markdown_enabled,
            collection_ids=[c.id for c in wa.collections],
            mcp_server_ids=[s.id for s in wa.mcp_servers],
        )


class WorkflowSummary(BaseModel):
    """List view — no graph, just counts."""

    id: str
    name: str
    node_count: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, wf) -> "WorkflowSummary":
        return cls(
            id=wf.id,
            name=wf.name,
            node_count=len(wf.nodes),
            created_at=wf.created_at,
            updated_at=wf.updated_at,
        )


class WorkflowResponse(BaseModel):
    id: str
    name: str
    nodes: list[NodeResponse]
    edges: list[EdgeResponse]
    conditions: list[ConditionResponse]
    agent_nodes: list[AgentNodeResponse]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, wf) -> "WorkflowResponse":
        return cls(
            id=wf.id,
            name=wf.name,
            nodes=[NodeResponse.model_validate(n) for n in wf.nodes],
            edges=[EdgeResponse.model_validate(e) for e in wf.edges],
            conditions=[
                ConditionResponse.model_validate(c)
                for c in sorted(wf.conditions, key=lambda c: c.order_index)
            ],
            agent_nodes=[AgentNodeResponse.from_model(a) for a in wf.agent_nodes],
            created_at=wf.created_at,
            updated_at=wf.updated_at,
        )

from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from src.models.node_model import NODE_TYPE_AGENT, NODE_TYPES


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


class EdgeInput(BaseModel):
    id: str | None = Field(default=None)
    source: str = Field(..., min_length=1)
    target: str = Field(..., min_length=1)


def validate_graph(nodes: list[NodeInput], edges: list[EdgeInput]) -> None:
    """Enforce the workflow graph rules. Raises ValueError on the first breach."""
    ids = [n.id for n in nodes]
    if len(ids) != len(set(ids)):
        raise ValueError("node ids must be unique")
    id_set = set(ids)

    start_count = sum(1 for n in nodes if n.is_start)
    if start_count > 1:
        raise ValueError("a workflow can have only one start node")
    if nodes and start_count == 0:
        raise ValueError("a workflow must have a start node")

    seen_pairs: set[frozenset[str]] = set()
    for e in edges:
        if e.source == e.target:
            raise ValueError("a node cannot connect to itself")
        if e.source not in id_set or e.target not in id_set:
            raise ValueError("an edge references a node that is not in the workflow")
        # One connection per node pair, regardless of direction (blocks both a
        # duplicate A->B and a reverse B->A).
        pair = frozenset((e.source, e.target))
        if pair in seen_pairs:
            raise ValueError("only one connection is allowed between two nodes")
        seen_pairs.add(pair)


class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["My Workflow"])
    nodes: list[NodeInput] = Field(default_factory=list)
    edges: list[EdgeInput] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty or whitespace")
        return v

    @model_validator(mode="after")
    def check_graph(self) -> "WorkflowCreate":
        validate_graph(self.nodes, self.edges)
        return self


class WorkflowReplace(BaseModel):
    """Full replacement of a workflow's name and graph (the canvas 'save')."""

    name: str = Field(..., min_length=1, max_length=100)
    nodes: list[NodeInput] = Field(default_factory=list)
    edges: list[EdgeInput] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty or whitespace")
        return v

    @model_validator(mode="after")
    def check_graph(self) -> "WorkflowReplace":
        validate_graph(self.nodes, self.edges)
        return self


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

    model_config = {"from_attributes": True}


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
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, wf) -> "WorkflowResponse":
        return cls(
            id=wf.id,
            name=wf.name,
            nodes=[NodeResponse.model_validate(n) for n in wf.nodes],
            edges=[EdgeResponse.model_validate(e) for e in wf.edges],
            created_at=wf.created_at,
            updated_at=wf.updated_at,
        )

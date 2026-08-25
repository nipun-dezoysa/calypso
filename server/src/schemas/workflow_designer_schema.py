import uuid
from types import UnionType
from typing import Union, get_args, get_origin

from pydantic import BaseModel, Field, field_validator, model_validator

from src.schemas.workflow_schema import (
    AgentNodeResponse,
    ConditionResponse,
    EdgeResponse,
    NodeResponse,
)

DESIGNER_ROLES = {"user", "assistant"}


class _Lenient(BaseModel):
    @model_validator(mode="before")
    @classmethod
    def _nulls_mean_unset(cls, data):
        if not isinstance(data, dict):
            return data
        optional = _nullable_fields(cls)
        return {k: v for k, v in data.items() if v is not None or k in optional}


def _nullable_fields(model: type[BaseModel]) -> set[str]:
    nullable = set()
    for name, info in model.model_fields.items():
        if get_origin(info.annotation) in (Union, UnionType) and type(None) in get_args(
            info.annotation
        ):
            nullable.add(name)
    return nullable


def _as_list(value):
    if isinstance(value, str):
        return [value]
    return value


class DraftNode(_Lenient):
    id: str = Field(..., min_length=1)
    type: str = Field(default="agent")
    is_start: bool = Field(default=False)
    position_x: float = Field(default=0.0)
    position_y: float = Field(default=0.0)


class DraftEdge(_Lenient):
    source: str = Field(default="")
    target: str = Field(default="")
    source_handle: str | None = Field(default=None)


class DraftCondition(_Lenient):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), min_length=1)
    n_id: str = Field(default="")
    label: str = Field(default="")
    operator: str = Field(default="contains")
    value: str | None = Field(default=None)
    case_sensitive: bool = Field(default=False)
    order_index: int = Field(default=0)


class DraftAgentNode(_Lenient):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), min_length=1)
    n_id: str = Field(default="")
    name: str = Field(default="")
    agent_id: str | None = Field(default=None)
    llm_model_id: str | None = Field(default=None)
    node_instructions: str = Field(default="")
    output_instructions: str = Field(default="")
    creativity: int | None = Field(default=None)
    markdown_enabled: bool | None = Field(default=None)
    collection_ids: list[str] = Field(default_factory=list)
    mcp_server_ids: list[str] = Field(default_factory=list)

    _listify = field_validator("collection_ids", "mcp_server_ids", mode="before")(_as_list)


class DraftWorkflow(BaseModel):
    """A workflow graph in whatever state the canvas is in."""

    name: str = Field(default="")
    nodes: list[DraftNode] = Field(default_factory=list)
    edges: list[DraftEdge] = Field(default_factory=list)
    conditions: list[DraftCondition] = Field(default_factory=list)
    agent_nodes: list[DraftAgentNode] = Field(default_factory=list)


class DesignerMessage(BaseModel):
    """One earlier turn of the designer conversation. The client owns this
    history, since the designer keeps nothing between requests."""

    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(default="")


class DesignRequest(BaseModel):
    message: str = Field(..., min_length=1, description="What the user asked for")
    llm_model_id: str = Field(
        ...,
        min_length=1,
        description="The model the designer itself runs on",
    )
    workflow: DraftWorkflow = Field(
        default_factory=DraftWorkflow,
        description="The graph currently on the canvas",
    )
    history: list[DesignerMessage] = Field(
        default_factory=list,
        description="Earlier turns of this designer conversation, oldest first",
    )


class ProposedWorkflow(BaseModel):
    """A complete graph, ready to drop onto the canvas and save as-is."""

    name: str
    nodes: list[NodeResponse]
    edges: list[EdgeResponse]
    conditions: list[ConditionResponse]
    agent_nodes: list[AgentNodeResponse]


class DesignResponse(BaseModel):
    reply: str = Field(description="What the designer wants to tell the user")
    workflow: ProposedWorkflow | None = Field(
        default=None,
        description="The proposed graph, or null when the turn was just talk",
    )
    notes: list[str] = Field(
        default_factory=list,
        description="Fixes the server applied to the proposal, or why it was dropped",
    )

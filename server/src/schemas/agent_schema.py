from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class AgentCreate(BaseModel):

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the agent",
        examples=["Support Bot"],
    )
    llm_model_id: str = Field(
        ...,
        description="ID of the LLMModel this agent uses",
    )
    agent_instructions: str = Field(
        ...,
        min_length=1,
        description="System prompt / instructions guiding the agent's behavior",
    )
    creativity: int = Field(
        default=50,
        ge=0,
        le=100,
        description="Creativity level (0-100), mapped to the provider's temperature range",
    )
    collection_ids: list[str] = Field(
        default_factory=list,
        description="IDs of knowledge-base collections to attach to this agent",
    )
    mcp_server_ids: list[str] = Field(
        default_factory=list,
        description="IDs of MCP servers to attach to this agent",
    )

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty or whitespace")
        return v

    @field_validator("agent_instructions")
    @classmethod
    def strip_agent_instructions(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("agent_instructions must not be empty or whitespace")
        return v


class AgentUpdate(BaseModel):
    """Schema for updating an agent. All fields are optional."""

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    llm_model_id: str | None = Field(default=None)
    agent_instructions: str | None = Field(default=None, min_length=1)
    creativity: int | None = Field(default=None, ge=0, le=100)
    collection_ids: list[str] | None = Field(
        default=None,
        description="Replace the agent's attached collections with these IDs",
    )
    mcp_server_ids: list[str] | None = Field(
        default=None,
        description="Replace the agent's attached MCP servers with these IDs",
    )

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty or whitespace")
        return v

    @field_validator("agent_instructions")
    @classmethod
    def strip_agent_instructions(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("agent_instructions must not be empty or whitespace")
        return v


class AgentLLMModelInfo(BaseModel):
    """Read-only summary of the model and provider an agent is linked to."""

    id: str
    model_name: str
    ai_provider_id: str
    provider_name: str

    model_config = {"from_attributes": True}


class AgentCollectionInfo(BaseModel):
    """Read-only summary of a knowledge-base collection attached to an agent."""

    id: str
    name: str

    model_config = {"from_attributes": True}


class AgentMcpServerInfo(BaseModel):
    """Read-only summary of an MCP server attached to an agent."""

    id: str
    name: str
    transport: str
    enabled: bool

    model_config = {"from_attributes": True}


class AgentResponse(BaseModel):
    """Schema returned from API responses."""

    id: str
    name: str
    llm_model_id: str
    llm_model: AgentLLMModelInfo
    agent_instructions: str
    creativity: int
    collections: list[AgentCollectionInfo] = []
    mcp_servers: list[AgentMcpServerInfo] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

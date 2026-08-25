from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from src.models.mcp_server_model import MCP_TRANSPORTS, STDIO, URL_TRANSPORTS


class McpServerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["filesystem"])
    transport: str = Field(
        default=STDIO,
        description=f"One of {sorted(MCP_TRANSPORTS)}",
    )
    # stdio
    command: str | None = Field(default=None, examples=["npx"])
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    cwd: str | None = Field(default=None)
    # url transports
    url: str | None = Field(default=None, examples=["http://localhost:8000/mcp/"])
    headers: dict[str, str] = Field(default_factory=dict)

    enabled: bool = Field(default=True)
    description: str | None = Field(default=None)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty or whitespace")
        return v

    @field_validator("transport")
    @classmethod
    def normalize_transport(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in MCP_TRANSPORTS:
            raise ValueError(f"transport must be one of {sorted(MCP_TRANSPORTS)}")
        return v

    @model_validator(mode="after")
    def check_transport_fields(self) -> "McpServerCreate":
        if self.transport == STDIO:
            if not (self.command and self.command.strip()):
                raise ValueError("command is required for the 'stdio' transport")
        elif self.transport in URL_TRANSPORTS:
            if not (self.url and self.url.strip()):
                raise ValueError(f"url is required for the '{self.transport}' transport")
        return self


class McpServerUpdate(BaseModel):
    """All fields optional. Note: when changing transport, supply the fields the
    new transport needs; they aren't re-validated against old values here."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    transport: str | None = Field(default=None)
    command: str | None = Field(default=None)
    args: list[str] | None = Field(default=None)
    env: dict[str, str] | None = Field(default=None)
    cwd: str | None = Field(default=None)
    url: str | None = Field(default=None)
    headers: dict[str, str] | None = Field(default=None)
    enabled: bool | None = Field(default=None)
    description: str | None = Field(default=None)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty or whitespace")
        return v

    @field_validator("transport")
    @classmethod
    def normalize_transport(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if v not in MCP_TRANSPORTS:
            raise ValueError(f"transport must be one of {sorted(MCP_TRANSPORTS)}")
        return v


class McpServerResponse(BaseModel):
    id: str
    name: str
    transport: str
    command: str | None
    args: list[str]
    env: dict[str, str]
    cwd: str | None
    url: str | None
    headers: dict[str, str]
    enabled: bool
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class McpToolInfo(BaseModel):
    name: str
    description: str | None = None


class McpTestResult(BaseModel):
    """Result of connecting to an MCP server and listing its tools."""

    ok: bool
    tool_count: int = 0
    tools: list[McpToolInfo] = []
    error: str | None = None

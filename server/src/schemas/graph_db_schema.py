from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field, field_validator

from src.models.graph_db_model import (
    DEFAULT_MAX_ROWS,
    DEFAULT_QUERY_TIMEOUT,
    GRAPH_DB_PROVIDERS,
    NEO4J,
    URI_SCHEMES,
)

if TYPE_CHECKING:
    from src.models.graph_db_model import GraphDatabase


def _validate_uri(v: str) -> str:
    v = (v or "").strip()
    if not v:
        raise ValueError("uri must not be empty or whitespace")
    if not v.startswith(URI_SCHEMES):
        raise ValueError(f"uri must start with one of {list(URI_SCHEMES)}")
    return v


class GraphDbCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["movies"])
    provider: str = Field(
        default=NEO4J, description=f"One of {sorted(GRAPH_DB_PROVIDERS)}"
    )
    uri: str = Field(..., examples=["bolt://localhost:7687"])
    username: str | None = Field(default=None, max_length=200, examples=["neo4j"])
    password: str | None = Field(default=None, max_length=500)
    database: str | None = Field(
        default=None,
        max_length=100,
        description="Leave empty to use the server's default database",
    )
    read_only: bool = Field(
        default=True,
        description="Run agent queries in a read transaction, so writes are rejected",
    )
    query_timeout: int = Field(default=DEFAULT_QUERY_TIMEOUT, ge=1, le=120)
    max_rows: int = Field(default=DEFAULT_MAX_ROWS, ge=1, le=500)
    enabled: bool = Field(default=True)
    description: str | None = Field(default=None)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty or whitespace")
        return v

    @field_validator("provider")
    @classmethod
    def normalize_provider(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in GRAPH_DB_PROVIDERS:
            raise ValueError(f"provider must be one of {sorted(GRAPH_DB_PROVIDERS)}")
        return v

    @field_validator("uri")
    @classmethod
    def check_uri(cls, v: str) -> str:
        return _validate_uri(v)


class GraphDbUpdate(BaseModel):
    """All fields optional. Omitting `password` keeps the stored one; sending
    an empty string clears it, for a server that takes no auth."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    provider: str | None = Field(default=None)
    uri: str | None = Field(default=None)
    username: str | None = Field(default=None, max_length=200)
    password: str | None = Field(default=None, max_length=500)
    database: str | None = Field(default=None, max_length=100)
    read_only: bool | None = Field(default=None)
    query_timeout: int | None = Field(default=None, ge=1, le=120)
    max_rows: int | None = Field(default=None, ge=1, le=500)
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

    @field_validator("provider")
    @classmethod
    def normalize_provider(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if v not in GRAPH_DB_PROVIDERS:
            raise ValueError(f"provider must be one of {sorted(GRAPH_DB_PROVIDERS)}")
        return v

    @field_validator("uri")
    @classmethod
    def check_uri(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _validate_uri(v)


class GraphDbResponse(BaseModel):
    """The password is never returned; `password_set` says whether one is
    stored, which is all the form needs to render."""

    id: str
    name: str
    provider: str
    uri: str
    username: str | None
    password_set: bool
    database: str | None
    read_only: bool
    query_timeout: int
    max_rows: int
    enabled: bool
    description: str | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, db: "GraphDatabase") -> "GraphDbResponse":
        return cls(
            id=db.id,
            name=db.name,
            provider=db.provider,
            uri=db.uri,
            username=db.username,
            password_set=bool(db.password),
            database=db.database,
            read_only=db.read_only,
            query_timeout=db.query_timeout,
            max_rows=db.max_rows,
            enabled=db.enabled,
            description=db.description,
            created_at=db.created_at,
            updated_at=db.updated_at,
        )


class GraphNodeInfo(BaseModel):
    label: str
    properties: list[str] = []


class GraphRelationshipInfo(BaseModel):
    type: str
    properties: list[str] = []


class GraphSchemaInfo(BaseModel):
    nodes: list[GraphNodeInfo] = []
    relationships: list[GraphRelationshipInfo] = []
    patterns: list[str] = []


class GraphDbTestResult(BaseModel):
    """Result of connecting to a graph database and reading its schema."""

    ok: bool
    node_label_count: int = 0
    relationship_type_count: int = 0
    graph_schema: GraphSchemaInfo | None = None
    error: str | None = None

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

# ── Collections ───────────────────────────────────────────────────────────


class CollectionCreate(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the collection",
        examples=["Product Docs"],
    )
    description: str | None = Field(
        default=None,
        description="Optional description of the collection",
    )

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty or whitespace")
        return v


class CollectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
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


class DocumentResponse(BaseModel):
    id: str
    collection_id: str
    filename: str
    content_type: str | None
    size_bytes: int | None
    status: str
    error_message: str | None
    chunk_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CollectionResponse(BaseModel):
    id: str
    name: str
    description: str | None
    document_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, collection) -> "CollectionResponse":
        return cls(
            id=collection.id,
            name=collection.name,
            description=collection.description,
            document_count=len(collection.documents),
            created_at=collection.created_at,
            updated_at=collection.updated_at,
        )


# ── Settings ──────────────────────────────────────────────────────────────


class KbSettingsUpdate(BaseModel):
    """All fields optional; only provided fields are changed. Secret values are
    write-only (never returned in responses)."""

    vector_db_provider: str | None = Field(
        default=None,
        description="Vector store provider: 'chroma' (default) or 'qdrant'",
    )
    qdrant_url: str | None = Field(default=None)
    qdrant_api_key: str | None = Field(default=None)
    embedding_provider: str | None = Field(
        default=None,
        description="Embedder: 'fastembed' (default) or 'nomic'",
    )
    embedding_model: str | None = Field(default=None)
    nomic_api_key: str | None = Field(default=None)


class KbSettingsResponse(BaseModel):
    """Read view of KB settings. Secret keys are masked to booleans indicating
    whether a value is configured."""

    vector_db_provider: str
    qdrant_url: str | None
    qdrant_api_key_set: bool
    embedding_provider: str
    embedding_model: str | None
    nomic_api_key_set: bool
    updated_at: datetime

    @classmethod
    def from_model(cls, settings) -> "KbSettingsResponse":
        return cls(
            vector_db_provider=settings.vector_db_provider,
            qdrant_url=settings.qdrant_url,
            qdrant_api_key_set=bool(settings.qdrant_api_key),
            embedding_provider=settings.embedding_provider,
            embedding_model=settings.embedding_model,
            nomic_api_key_set=bool(settings.nomic_api_key),
            updated_at=settings.updated_at,
        )

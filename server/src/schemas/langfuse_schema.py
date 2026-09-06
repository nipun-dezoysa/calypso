from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class LangfuseSettingsUpdate(BaseModel):
    """All fields optional; only the provided ones are changed."""

    enabled: bool | None = Field(
        default=None,
        description="Turn tracing on or off",
    )
    host: str | None = Field(
        default=None,
        description="Langfuse server, e.g. https://cloud.langfuse.com",
    )
    public_key: str | None = Field(default=None, description="pk-lf-…")
    secret_key: str | None = Field(default=None, description="sk-lf-…")
    environment: str | None = Field(
        default=None,
        max_length=100,
        description="Label traces are grouped by, e.g. 'production'",
    )
    sample_rate: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Fraction of traces sent, 0.0–1.0",
    )

    @field_validator("host", "public_key", "secret_key", "environment")
    @classmethod
    def blank_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class LangfuseCredentialsTest(BaseModel):
    """Credentials to try. Anything left out is taken from what is saved,
    so the modal can test without re-typing a stored secret key."""

    host: str | None = Field(default=None)
    public_key: str | None = Field(default=None)
    secret_key: str | None = Field(default=None)

    @field_validator("host", "public_key", "secret_key")
    @classmethod
    def blank_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class LangfuseTestResponse(BaseModel):
    ok: bool
    detail: str


class LangfuseSettingsResponse(BaseModel):
    enabled: bool
    host: str
    public_key: str | None
    secret_key_set: bool
    environment: str | None
    sample_rate: float
    active: bool
    updated_at: datetime

    @classmethod
    def from_model(cls, row, config) -> "LangfuseSettingsResponse":
        return cls(
            enabled=config.enabled,
            host=config.host,
            public_key=config.public_key,
            secret_key_set=bool(config.secret_key),
            environment=config.environment,
            sample_rate=config.sample_rate,
            active=config.is_active,
            updated_at=row.updated_at,
        )

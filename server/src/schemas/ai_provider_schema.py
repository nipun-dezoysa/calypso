from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl, field_validator


class AIProviderCreate(BaseModel):

    provider_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the AI provider",
        examples=["OpenAI"],
    )
    model_names: list[str] = Field(
        ...,
        min_length=1,
        description="List of model names supported by this provider",
        examples=[["gpt-4o", "gpt-4o-mini"]],
    )
    url: HttpUrl | None = Field(
        default=None,
        description="Base URL for the provider API",
        examples=["https://api.openai.com/v1"],
    )
    secret_key: str | None = Field(
        default=None,
        max_length=500,
        description="API secret key for authentication",
    )

    @field_validator("provider_name")
    @classmethod
    def strip_provider_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("provider_name must not be empty or whitespace")
        return v

    @field_validator("model_names")
    @classmethod
    def validate_model_names(cls, v: list[str]) -> list[str]:
        cleaned = [name.strip() for name in v]
        if any(not name for name in cleaned):
            raise ValueError("All model names must be non-empty strings")
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("Duplicate model names are not allowed")
        return cleaned

    @field_validator("url", mode="before")
    @classmethod
    def coerce_url(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            v = v.strip()
            return v if v else None
        return v


class AIProviderUpdate(BaseModel):
    """Schema for updating an AI provider. All fields are optional."""

    provider_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    model_names: list[str] | None = Field(default=None, min_length=1)
    url: HttpUrl | None = Field(default=None)
    secret_key: str | None = Field(default=None, max_length=500)

    @field_validator("provider_name")
    @classmethod
    def strip_provider_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("provider_name must not be empty or whitespace")
        return v

    @field_validator("model_names")
    @classmethod
    def validate_model_names(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        cleaned = [name.strip() for name in v]
        if any(not name for name in cleaned):
            raise ValueError("All model names must be non-empty strings")
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("Duplicate model names are not allowed")
        return cleaned

    @field_validator("url", mode="before")
    @classmethod
    def coerce_url(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            v = v.strip()
            return v if v else None
        return v


class AIProviderResponse(BaseModel):
    """Schema returned from API responses."""

    id: str
    provider_name: str
    model_names: list[str]
    url: str | None
    secret_key: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

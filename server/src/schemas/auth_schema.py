from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# bcrypt only hashes the first 72 bytes, so anything longer would silently be
# truncated. Reject it instead of pretending the extra characters count.
MAX_PASSWORD_LENGTH = 72


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100, examples=["admin"])
    password: str = Field(..., min_length=1, max_length=MAX_PASSWORD_LENGTH)

    @field_validator("username")
    @classmethod
    def strip_username(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("username must not be empty or whitespace")
        return v


class CredentialsUpdate(BaseModel):
    """Change username and/or password. The current password is always required
    so a leaked token alone cannot lock the owner out of their own instance."""

    current_password: str = Field(..., min_length=1, max_length=MAX_PASSWORD_LENGTH)
    username: str | None = Field(default=None, min_length=1, max_length=100)
    new_password: str | None = Field(
        default=None,
        min_length=8,
        max_length=MAX_PASSWORD_LENGTH,
        description="At least 8 characters. Omit to keep the current password.",
    )

    @field_validator("username")
    @classmethod
    def strip_username(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("username must not be empty or whitespace")
        return v

    @model_validator(mode="after")
    def require_a_change(self) -> "CredentialsUpdate":
        if self.username is None and self.new_password is None:
            raise ValueError("provide a new username, a new password, or both")
        return self


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    must_change_credentials: bool
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Token lifetime in seconds")
    user: UserResponse

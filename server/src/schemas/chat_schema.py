from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ChatAskRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=1,
        description="The question to ask the agent",
        examples=["What's the status of my order?"],
    )
    thread_id: str | None = Field(
        default=None,
        description="Existing thread to continue. Omit to start a new thread.",
    )

    @field_validator("question")
    @classmethod
    def question_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("question must not be blank")
        return value


class ChatAskResponse(BaseModel):
    thread_id: str
    answer: str


class MessageResponse(BaseModel):
    id: str
    thread_id: str
    is_bot: bool
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ThreadResponse(BaseModel):
    id: str
    type: str
    agent_id: str | None
    workflow_id: str | None
    title: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

from datetime import datetime
from typing import Self

from pydantic import BaseModel, Field, field_validator, model_validator


class AttachmentResponse(BaseModel):
    id: str
    filename: str
    content_type: str | None
    size_bytes: int | None
    kind: str
    status: str
    error_message: str | None
    has_text: bool
    created_at: datetime

    @classmethod
    def from_model(cls, attachment) -> "AttachmentResponse":
        return cls(
            id=attachment.id,
            filename=attachment.filename,
            content_type=attachment.content_type,
            size_bytes=attachment.size_bytes,
            kind=attachment.kind,
            status=attachment.status,
            error_message=attachment.error_message,
            has_text=bool(attachment.extracted_text),
            created_at=attachment.created_at,
        )


class ChatAskRequest(BaseModel):
    question: str = Field(
        default="",
        description="The question to ask the agent. May be blank if attachments are sent.",
        examples=["What's the status of my order?"],
    )
    thread_id: str | None = Field(
        default=None,
        description="Existing thread to continue. Omit to start a new thread.",
    )
    attachment_ids: list[str] = Field(
        default_factory=list,
        description=(
            "Ids from POST /chat/attachments, sent with this message. Each may "
            "only be used once."
        ),
    )

    @field_validator("question")
    @classmethod
    def strip_question(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def require_question_or_attachment(self) -> Self:
        if not self.question and not self.attachment_ids:
            raise ValueError("send a question, an attachment, or both")
        return self


class ChatAskResponse(BaseModel):
    thread_id: str
    answer: str


class MessageResponse(BaseModel):
    id: str
    thread_id: str
    is_bot: bool
    content: str
    created_at: datetime
    attachments: list[AttachmentResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, message) -> "MessageResponse":
        return cls(
            id=message.id,
            thread_id=message.thread_id,
            is_bot=message.is_bot,
            content=message.content,
            created_at=message.created_at,
            attachments=[
                AttachmentResponse.from_model(a) for a in message.attachments
            ],
        )


class ThreadResponse(BaseModel):
    id: str
    type: str
    agent_id: str | None
    workflow_id: str | None
    title: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

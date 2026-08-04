import os

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.dependencies.auth import require_auth
from src.schemas.chat_schema import (
    AttachmentResponse,
    ChatAskRequest,
    ChatAskResponse,
    MessageResponse,
    ThreadResponse,
)
from src.services.attachment_extract import UnsupportedFileError
from src.services.attachment_service import AttachmentService
from src.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["Chat"])


def _get_service(db: AsyncSession = Depends(get_db)) -> ChatService:
    return ChatService(db)


def _get_attachment_service(db: AsyncSession = Depends(get_db)) -> AttachmentService:
    return AttachmentService(db)


# Deliberately unauthenticated: this is the endpoint other applications embed.
# Provider secret keys are never exposed through it, only the answer text.
@router.post(
    "/{target_id}/ask",
    response_model=ChatAskResponse,
    summary="Ask a question to an agent or a workflow (public)",
)
async def ask(
    target_id: str,
    data: ChatAskRequest,
    service: ChatService = Depends(_get_service),
    attachment_service: AttachmentService = Depends(_get_attachment_service),
) -> ChatAskResponse:
    attachments = await attachment_service.get_unsent(data.attachment_ids)
    if len(attachments) != len(data.attachment_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more attachments do not exist, or were already sent",
        )

    try:
        result = await service.answer(
            target_id, data.question, data.thread_id, attachments
        )
    except ValueError as exc:
        # Workflow/graph configuration problems (e.g. no start node).
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to get a response from the LLM provider: {exc}",
        ) from exc

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No agent or workflow with id '{target_id}', or thread does not belong to it",
        )

    thread_id, answer = result
    return ChatAskResponse(thread_id=thread_id, answer=answer)


@router.get(
    "/{target_id}/threads",
    response_model=list[ThreadResponse],
    summary="List conversation threads for an agent or workflow",
    dependencies=[Depends(require_auth)],
)
async def list_threads(
    target_id: str,
    service: ChatService = Depends(_get_service),
) -> list[ThreadResponse]:
    threads = await service.list_threads(target_id)
    return [ThreadResponse.model_validate(t) for t in threads]


@router.delete(
    "/threads/{thread_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a conversation thread and its messages",
    dependencies=[Depends(require_auth)],
)
async def delete_thread(
    thread_id: str,
    service: ChatService = Depends(_get_service),
) -> None:
    deleted = await service.delete_thread(thread_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thread with id '{thread_id}' not found",
        )


@router.get(
    "/threads/{thread_id}/messages",
    response_model=list[MessageResponse],
    summary="List messages in a thread",
    dependencies=[Depends(require_auth)],
)
async def list_messages(
    thread_id: str,
    service: ChatService = Depends(_get_service),
) -> list[MessageResponse]:
    messages = await service.list_messages(thread_id)
    if messages is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thread with id '{thread_id}' not found",
        )
    return [MessageResponse.from_model(m) for m in messages]

@router.post(
    "/attachments",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a file to send with a chat message",
    dependencies=[Depends(require_auth)],
)
async def upload_attachment(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    service: AttachmentService = Depends(_get_attachment_service),
) -> AttachmentResponse:
    try:
        attachment = await service.create(file)
    except UnsupportedFileError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    # Sweep abandoned uploads after the response goes out.
    background_tasks.add_task(_purge_orphans)
    return AttachmentResponse.from_model(attachment)


@router.get(
    "/attachments/{attachment_id}/content",
    summary="Download an attachment's original file",
    dependencies=[Depends(require_auth)],
    response_class=FileResponse,
)
async def download_attachment(
    attachment_id: str,
    service: AttachmentService = Depends(_get_attachment_service),
) -> FileResponse:
    attachment = await service.get(attachment_id)
    if attachment is None or not os.path.exists(attachment.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attachment with id '{attachment_id}' not found",
        )
    return FileResponse(
        attachment.file_path,
        media_type=attachment.content_type or "application/octet-stream",
        filename=attachment.filename,
    )


@router.delete(
    "/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an attachment",
    dependencies=[Depends(require_auth)],
)
async def delete_attachment(
    attachment_id: str,
    service: AttachmentService = Depends(_get_attachment_service),
) -> None:
    deleted = await service.delete(attachment_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attachment with id '{attachment_id}' not found",
        )


async def _purge_orphans() -> None:
    """Housekeeping on its own session — the request's is closed by now."""
    from src.database import async_session

    async with async_session() as db:
        try:
            await AttachmentService(db).purge_orphans()
        except Exception:  # noqa: BLE001 - never let cleanup break an upload
            pass

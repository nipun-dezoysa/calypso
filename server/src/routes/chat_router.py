import asyncio
import json
import os

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from src.database import async_session, get_db
from src.dependencies.auth import require_auth
from src.dependencies.rate_limit import limiter
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

# Streaming runs are detached from the request that started them (see
# _stream_run); this keeps a reference so the loop cannot collect one mid-answer.
_running: set[asyncio.Task] = set()

# How long to wait on the queue before sending a comment line. Time to first
# token on a local model runs to minutes, and an idle connection is exactly what
# a proxy in between decides to close.
SSE_HEARTBEAT_SECONDS = 15


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
@limiter.limit(settings.public_chat_rate_limit)
async def ask(
    request: Request,
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

@router.post(
    "/{target_id}/ask/stream",
    summary="Ask an agent or a workflow, streaming the answer back (public)",
    response_class=StreamingResponse,
)
@limiter.limit(settings.public_chat_rate_limit)
async def ask_stream(
    request: Request,
    target_id: str,
    data: ChatAskRequest,
    attachment_service: AttachmentService = Depends(_get_attachment_service),
) -> StreamingResponse:

    attachments = await attachment_service.get_unsent(data.attachment_ids)
    if len(attachments) != len(data.attachment_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more attachments do not exist, or were already sent",
        )

    queue: asyncio.Queue[dict | None] = asyncio.Queue()
    stop = asyncio.Event()

    task = asyncio.create_task(_stream_run(target_id, data, queue, stop))
    _running.add(task)
    task.add_done_callback(_running.discard)

    async def events():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(
                        queue.get(), timeout=SSE_HEARTBEAT_SECONDS
                    )
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                if event is None:
                    break
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            stop.set()

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _stream_run(
    target_id: str,
    data: ChatAskRequest,
    queue: "asyncio.Queue[dict | None]",
    stop: asyncio.Event,
) -> None:
    async with async_session() as db:
        try:
            attachments = await AttachmentService(db).get_unsent(data.attachment_ids)
            await ChatService(db).run_streaming(
                target_id,
                data.question,
                data.thread_id,
                attachments,
                queue.put,
                stop,
            )
        except Exception as exc: 
            await queue.put({"type": "error", "detail": str(exc)})
        finally:
            await queue.put(None)


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

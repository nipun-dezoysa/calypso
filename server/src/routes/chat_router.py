from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.schemas.chat_schema import (
    ChatAskRequest,
    ChatAskResponse,
    MessageResponse,
    ThreadResponse,
)
from src.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["Chat"])


def _get_service(db: AsyncSession = Depends(get_db)) -> ChatService:
    return ChatService(db)


@router.post(
    "/{target_id}/ask",
    response_model=ChatAskResponse,
    summary="Ask a question to an agent or a workflow",
)
async def ask(
    target_id: str,
    data: ChatAskRequest,
    service: ChatService = Depends(_get_service),
) -> ChatAskResponse:
    try:
        result = await service.answer(target_id, data.question, data.thread_id)
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
    return [MessageResponse.model_validate(m) for m in messages]

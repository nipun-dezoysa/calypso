from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.schemas.ai_provider_schema import (
    AIProviderCreate,
    AIProviderResponse,
    AIProviderUpdate,
)
from src.services.ai_provider_service import AIProviderService

router = APIRouter(prefix="/ai-providers", tags=["AI Providers"])


def _get_service(db: AsyncSession = Depends(get_db)) -> AIProviderService:
    return AIProviderService(db)


@router.post(
    "/",
    response_model=AIProviderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new AI provider",
)
async def create_provider(
    data: AIProviderCreate,
    service: AIProviderService = Depends(_get_service),
) -> AIProviderResponse:
    existing = await service.get_by_name(data.provider_name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Provider with name '{data.provider_name}' already exists",
        )
    provider = await service.create(data)
    return AIProviderResponse.model_validate(provider)


@router.get(
    "/",
    response_model=list[AIProviderResponse],
    summary="List all AI providers",
)
async def list_providers(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Max records to return"),
    service: AIProviderService = Depends(_get_service),
) -> list[AIProviderResponse]:
    providers = await service.get_all(skip=skip, limit=limit)
    return [AIProviderResponse.model_validate(p) for p in providers]


@router.get(
    "/{provider_id}",
    response_model=AIProviderResponse,
    summary="Get an AI provider by ID",
)
async def get_provider(
    provider_id: str,
    service: AIProviderService = Depends(_get_service),
) -> AIProviderResponse:
    provider = await service.get_by_id(provider_id)
    if provider is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AI provider with id '{provider_id}' not found",
        )
    return AIProviderResponse.model_validate(provider)


@router.patch(
    "/{provider_id}",
    response_model=AIProviderResponse,
    summary="Update an AI provider",
)
async def update_provider(
    provider_id: str,
    data: AIProviderUpdate,
    service: AIProviderService = Depends(_get_service),
) -> AIProviderResponse:
    # Check for name conflict if provider_name is being updated
    if data.provider_name is not None:
        existing = await service.get_by_name(data.provider_name)
        if existing and existing.id != provider_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Provider with name '{data.provider_name}' already exists",
            )

    provider = await service.update(provider_id, data)
    if provider is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AI provider with id '{provider_id}' not found",
        )
    return AIProviderResponse.model_validate(provider)


@router.delete(
    "/{provider_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an AI provider",
)
async def delete_provider(
    provider_id: str,
    service: AIProviderService = Depends(_get_service),
) -> None:
    deleted = await service.delete(provider_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AI provider with id '{provider_id}' not found",
        )

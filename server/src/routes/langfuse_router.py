from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.schemas.langfuse_schema import (
    LangfuseCredentialsTest,
    LangfuseSettingsResponse,
    LangfuseSettingsUpdate,
    LangfuseTestResponse,
)
from src.services import langfuse_tracing
from src.services.langfuse_settings_service import LangfuseSettingsService
from src.services.langfuse_tracing import LangfuseConfig

router = APIRouter(prefix="/langfuse", tags=["Observability"])


def _get_service(db: AsyncSession = Depends(get_db)) -> LangfuseSettingsService:
    return LangfuseSettingsService(db)


@router.get(
    "/settings",
    response_model=LangfuseSettingsResponse,
    summary="Get Langfuse tracing settings",
)
async def get_settings(
    service: LangfuseSettingsService = Depends(_get_service),
) -> LangfuseSettingsResponse:
    row = await service.get()
    return LangfuseSettingsResponse.from_model(row, LangfuseConfig.from_settings(row))


@router.put(
    "/settings",
    response_model=LangfuseSettingsResponse,
    summary="Update Langfuse tracing settings",
)
async def update_settings(
    data: LangfuseSettingsUpdate,
    service: LangfuseSettingsService = Depends(_get_service),
) -> LangfuseSettingsResponse:
    try:
        row = await service.update(data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )
    return LangfuseSettingsResponse.from_model(row, LangfuseConfig.from_settings(row))


@router.post(
    "/settings/test",
    response_model=LangfuseTestResponse,
    summary="Check Langfuse credentials against the server",
)
async def test_connection(
    data: LangfuseCredentialsTest,
    service: LangfuseSettingsService = Depends(_get_service),
) -> LangfuseTestResponse:
    """Try the given credentials, falling back to the saved ones for anything
    left blank, so the modal can test without re-typing the secret key."""
    saved = await service.get_config()
    cfg = LangfuseConfig(
        enabled=True,
        host=(data.host or saved.host).rstrip("/"),
        public_key=data.public_key or saved.public_key,
        secret_key=data.secret_key or saved.secret_key,
        environment=saved.environment,
        sample_rate=saved.sample_rate,
    )
    ok, detail = await langfuse_tracing.auth_check(cfg)
    return LangfuseTestResponse(ok=ok, detail=detail)

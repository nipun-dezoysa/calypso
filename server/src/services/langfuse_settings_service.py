import logging

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.langfuse_settings_model import (
    LANGFUSE_SETTINGS_SINGLETON_ID,
    LangfuseSettings,
)
from src.schemas.langfuse_schema import LangfuseSettingsUpdate
from src.services import langfuse_tracing
from src.services.langfuse_tracing import LangfuseConfig

logger = logging.getLogger(__name__)


class LangfuseSettingsService:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self) -> LangfuseSettings:
        row = await self.db.get(LangfuseSettings, LANGFUSE_SETTINGS_SINGLETON_ID)
        if row is None:
            row = LangfuseSettings(id=LANGFUSE_SETTINGS_SINGLETON_ID)
            self.db.add(row)
            await self.db.commit()
            await self.db.refresh(row)
        return row

    async def update(self, data: LangfuseSettingsUpdate) -> LangfuseSettings:
        row = await self.get()
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(row, field, value)
        await self.db.commit()
        await self.db.refresh(row)
        # Pick the new credentials up straight away rather than at the next run.
        await self.activate()
        return row

    async def get_config(self) -> LangfuseConfig:
        row = await self.db.get(LangfuseSettings, LANGFUSE_SETTINGS_SINGLETON_ID)
        return LangfuseConfig.from_settings(row)

    async def activate(self) -> None:
        try:
            langfuse_tracing.apply(await self.get_config())
        except Exception: 
            logger.exception("Could not apply the Langfuse settings")

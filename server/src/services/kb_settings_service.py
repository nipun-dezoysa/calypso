from sqlalchemy.ext.asyncio import AsyncSession

from config import settings as app_settings
from src.models.kb_settings_model import SETTINGS_SINGLETON_ID, KbSettings
from src.schemas.kb_schema import KbSettingsUpdate
from src.services.kb_vectorstore import KbConfig


class KbSettingsService:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self) -> KbSettings:
        row = await self.db.get(KbSettings, SETTINGS_SINGLETON_ID)
        if row is None:
            row = KbSettings(id=SETTINGS_SINGLETON_ID)
            self.db.add(row)
            await self.db.commit()
            await self.db.refresh(row)
        return row

    async def update(self, data: KbSettingsUpdate) -> KbSettings:
        row = await self.get()
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(row, field, value)
        await self.db.commit()
        await self.db.refresh(row)
        return row

    async def get_config(self) -> KbConfig:
        row = await self.get()
        return KbConfig.from_settings(row, app_settings.chroma_persist_dir)

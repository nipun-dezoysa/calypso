from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.ai_provide_model import AIProvider
from src.schemas.ai_provider_schema import AIProviderCreate, AIProviderUpdate


class AIProviderService:
    """Service layer handling all AI provider database operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, data: AIProviderCreate) -> AIProvider:
        """Create a new AI provider."""
        provider = AIProvider(
            provider_name=data.provider_name,
            model_names=data.model_names,
            url=str(data.url) if data.url else None,
            secret_key=data.secret_key,
        )
        self.db.add(provider)
        await self.db.commit()
        await self.db.refresh(provider)
        return provider

    async def get_by_id(self, provider_id: str) -> AIProvider | None:
        """Get an AI provider by its ID."""
        return await self.db.get(AIProvider, provider_id)

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
    ) -> list[AIProvider]:
        """Get all AI providers with pagination."""
        stmt = (
            select(AIProvider)
            .order_by(AIProvider.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update(
        self,
        provider_id: str,
        data: AIProviderUpdate,
    ) -> AIProvider | None:
        """Update an existing AI provider. Returns None if not found."""
        provider = await self.get_by_id(provider_id)
        if provider is None:
            return None

        update_data = data.model_dump(exclude_unset=True)

        # Convert HttpUrl to str for the ORM
        if "url" in update_data and update_data["url"] is not None:
            update_data["url"] = str(update_data["url"])

        for field, value in update_data.items():
            setattr(provider, field, value)

        await self.db.commit()
        await self.db.refresh(provider)
        return provider

    async def delete(self, provider_id: str) -> bool:
        """Delete an AI provider. Returns True if deleted, False if not found."""
        provider = await self.get_by_id(provider_id)
        if provider is None:
            return False

        await self.db.delete(provider)
        await self.db.commit()
        return True

    async def get_by_name(self, provider_name: str) -> AIProvider | None:
        """Get an AI provider by its name."""
        stmt = select(AIProvider).where(AIProvider.provider_name == provider_name)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

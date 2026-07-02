from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.agent_model import Agent
from src.models.ai_provide_model import AIProvider
from src.models.llm_model import LLMModel
from src.schemas.ai_provider_schema import AIProviderCreate, AIProviderUpdate


class AIProviderService:
    """Service layer handling all AI provider database operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, data: AIProviderCreate) -> AIProvider:
        """Create a new AI provider."""
        provider = AIProvider(
            provider_name=data.provider_name,
            url=str(data.url) if data.url else None,
            secret_key=data.secret_key,
            models=[LLMModel(model_name=name) for name in data.model_names],
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

        model_names = update_data.pop("model_names", None)
        if model_names is not None:
            await self._sync_models(provider, model_names)

        for field, value in update_data.items():
            setattr(provider, field, value)

        await self.db.commit()
        await self.db.refresh(provider)
        return provider

    async def _sync_models(self, provider: AIProvider, model_names: list[str]) -> None:
        """Reconcile `provider.models` with the given list of model names."""
        current_by_name = {m.model_name: m for m in provider.models}
        new_names = set(model_names)

        to_remove = [m for name, m in current_by_name.items() if name not in new_names]
        if to_remove:
            stmt = select(Agent.id).where(
                Agent.llm_model_id.in_([m.id for m in to_remove])
            )
            result = await self.db.execute(stmt)
            if result.scalars().first() is not None:
                raise ValueError(
                    "Cannot remove a model that is still assigned to an agent"
                )
            for m in to_remove:
                provider.models.remove(m)

        for name in model_names:
            if name not in current_by_name:
                provider.models.append(LLMModel(model_name=name))

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

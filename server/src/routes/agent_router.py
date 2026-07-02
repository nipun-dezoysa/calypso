from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.schemas.agent_schema import AgentCreate, AgentResponse, AgentUpdate
from src.services.agent_service import AgentService

router = APIRouter(prefix="/agents", tags=["Agents"])


def _get_service(db: AsyncSession = Depends(get_db)) -> AgentService:
    return AgentService(db)


@router.post(
    "/",
    response_model=AgentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new agent",
)
async def create_agent(
    data: AgentCreate,
    service: AgentService = Depends(_get_service),
) -> AgentResponse:
    existing = await service.get_by_name(data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Agent with name '{data.name}' already exists",
        )

    llm_model = await service.get_llm_model(data.llm_model_id)
    if llm_model is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"LLM model with id '{data.llm_model_id}' not found",
        )

    agent = await service.create(data)
    return AgentResponse.model_validate(agent)


@router.get(
    "/",
    response_model=list[AgentResponse],
    summary="List all agents",
)
async def list_agents(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Max records to return"),
    service: AgentService = Depends(_get_service),
) -> list[AgentResponse]:
    agents = await service.get_all(skip=skip, limit=limit)
    return [AgentResponse.model_validate(a) for a in agents]


@router.get(
    "/{agent_id}",
    response_model=AgentResponse,
    summary="Get an agent by ID",
)
async def get_agent(
    agent_id: str,
    service: AgentService = Depends(_get_service),
) -> AgentResponse:
    agent = await service.get_by_id(agent_id)
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent with id '{agent_id}' not found",
        )
    return AgentResponse.model_validate(agent)


@router.patch(
    "/{agent_id}",
    response_model=AgentResponse,
    summary="Update an agent",
)
async def update_agent(
    agent_id: str,
    data: AgentUpdate,
    service: AgentService = Depends(_get_service),
) -> AgentResponse:
    # Check for name conflict if name is being updated
    if data.name is not None:
        existing = await service.get_by_name(data.name)
        if existing and existing.id != agent_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Agent with name '{data.name}' already exists",
            )

    if data.llm_model_id is not None:
        llm_model = await service.get_llm_model(data.llm_model_id)
        if llm_model is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"LLM model with id '{data.llm_model_id}' not found",
            )

    agent = await service.update(agent_id, data)
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent with id '{agent_id}' not found",
        )
    return AgentResponse.model_validate(agent)


@router.delete(
    "/{agent_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an agent",
)
async def delete_agent(
    agent_id: str,
    service: AgentService = Depends(_get_service),
) -> None:
    deleted = await service.delete(agent_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent with id '{agent_id}' not found",
        )

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.schemas.workflow_schema import (
    WorkflowCreate,
    WorkflowReplace,
    WorkflowResponse,
    WorkflowSummary,
)
from src.services.workflow_service import WorkflowService

router = APIRouter(prefix="/workflows", tags=["Workflows"])


def _get_service(db: AsyncSession = Depends(get_db)) -> WorkflowService:
    return WorkflowService(db)


@router.post(
    "/",
    response_model=WorkflowResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a workflow",
)
async def create_workflow(
    data: WorkflowCreate,
    service: WorkflowService = Depends(_get_service),
) -> WorkflowResponse:
    try:
        wf = await service.create(data)
    except ValueError as exc:  # an agent node points at something that is gone
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    return WorkflowResponse.from_model(wf)


@router.get(
    "/",
    response_model=list[WorkflowSummary],
    summary="List workflows",
)
async def list_workflows(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: WorkflowService = Depends(_get_service),
) -> list[WorkflowSummary]:
    workflows = await service.list(skip=skip, limit=limit)
    return [WorkflowSummary.from_model(w) for w in workflows]


@router.get(
    "/{workflow_id}",
    response_model=WorkflowResponse,
    summary="Get a workflow with its full graph",
)
async def get_workflow(
    workflow_id: str,
    service: WorkflowService = Depends(_get_service),
) -> WorkflowResponse:
    wf = await service.get(workflow_id)
    if wf is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow with id '{workflow_id}' not found",
        )
    return WorkflowResponse.from_model(wf)


@router.put(
    "/{workflow_id}",
    response_model=WorkflowResponse,
    summary="Replace a workflow's name and graph",
)
async def replace_workflow(
    workflow_id: str,
    data: WorkflowReplace,
    service: WorkflowService = Depends(_get_service),
) -> WorkflowResponse:
    try:
        wf = await service.replace(workflow_id, data)
    except ValueError as exc:  # an agent node points at something that is gone
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    if wf is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow with id '{workflow_id}' not found",
        )
    return WorkflowResponse.from_model(wf)


@router.delete(
    "/{workflow_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a workflow and its graph",
)
async def delete_workflow(
    workflow_id: str,
    service: WorkflowService = Depends(_get_service),
) -> None:
    deleted = await service.delete(workflow_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow with id '{workflow_id}' not found",
        )

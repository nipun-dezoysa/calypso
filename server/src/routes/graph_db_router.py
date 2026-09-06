from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.schemas.graph_db_schema import (
    GraphDbCreate,
    GraphDbResponse,
    GraphDbTestResult,
    GraphDbUpdate,
    GraphSchemaInfo,
)
from src.services.graph_client import GraphError
from src.services.graph_db_service import GraphDbService

router = APIRouter(prefix="/graph-databases", tags=["Graph Databases"])


def _get_service(db: AsyncSession = Depends(get_db)) -> GraphDbService:
    return GraphDbService(db)


async def _require(service: GraphDbService, graph_db_id: str):
    graph_db = await service.get_by_id(graph_db_id)
    if graph_db is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Graph database with id '{graph_db_id}' not found",
        )
    return graph_db


@router.post(
    "/",
    response_model=GraphDbResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a graph database",
)
async def create_graph_db(
    data: GraphDbCreate,
    service: GraphDbService = Depends(_get_service),
) -> GraphDbResponse:
    existing = await service.get_by_name(data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Graph database with name '{data.name}' already exists",
        )
    try:
        graph_db = await service.create(data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )
    return GraphDbResponse.from_model(graph_db)


@router.get(
    "/",
    response_model=list[GraphDbResponse],
    summary="List graph databases",
)
async def list_graph_dbs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: GraphDbService = Depends(_get_service),
) -> list[GraphDbResponse]:
    graph_dbs = await service.get_all(skip=skip, limit=limit)
    return [GraphDbResponse.from_model(g) for g in graph_dbs]


@router.get(
    "/{graph_db_id}",
    response_model=GraphDbResponse,
    summary="Get a graph database by ID",
)
async def get_graph_db(
    graph_db_id: str,
    service: GraphDbService = Depends(_get_service),
) -> GraphDbResponse:
    graph_db = await _require(service, graph_db_id)
    return GraphDbResponse.from_model(graph_db)


@router.patch(
    "/{graph_db_id}",
    response_model=GraphDbResponse,
    summary="Update a graph database",
)
async def update_graph_db(
    graph_db_id: str,
    data: GraphDbUpdate,
    service: GraphDbService = Depends(_get_service),
) -> GraphDbResponse:
    if data.name is not None:
        existing = await service.get_by_name(data.name)
        if existing and existing.id != graph_db_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Graph database with name '{data.name}' already exists",
            )

    try:
        graph_db = await service.update(graph_db_id, data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )
    if graph_db is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Graph database with id '{graph_db_id}' not found",
        )
    return GraphDbResponse.from_model(graph_db)


@router.delete(
    "/{graph_db_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a graph database",
)
async def delete_graph_db(
    graph_db_id: str,
    service: GraphDbService = Depends(_get_service),
) -> None:
    deleted = await service.delete(graph_db_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Graph database with id '{graph_db_id}' not found",
        )


@router.post(
    "/{graph_db_id}/test",
    response_model=GraphDbTestResult,
    summary="Connect to a graph database and read back its schema",
)
async def test_graph_db(
    graph_db_id: str,
    service: GraphDbService = Depends(_get_service),
) -> GraphDbTestResult:
    graph_db = await _require(service, graph_db_id)
    return await service.test_connection(graph_db)


@router.get(
    "/{graph_db_id}/schema",
    response_model=GraphSchemaInfo,
    summary="Node labels, relationship types, and connecting patterns",
)
async def get_graph_db_schema(
    graph_db_id: str,
    service: GraphDbService = Depends(_get_service),
) -> GraphSchemaInfo:
    graph_db = await _require(service, graph_db_id)
    try:
        return await service.fetch_schema(graph_db)
    except GraphError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        )

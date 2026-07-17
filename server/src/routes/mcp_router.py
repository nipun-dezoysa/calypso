from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.schemas.mcp_schema import (
    McpServerCreate,
    McpServerResponse,
    McpServerUpdate,
    McpTestResult,
)
from src.services.mcp_service import McpService

router = APIRouter(prefix="/mcp-servers", tags=["MCP Servers"])


def _get_service(db: AsyncSession = Depends(get_db)) -> McpService:
    return McpService(db)


@router.post(
    "/",
    response_model=McpServerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an MCP server",
)
async def create_mcp_server(
    data: McpServerCreate,
    service: McpService = Depends(_get_service),
) -> McpServerResponse:
    existing = await service.get_by_name(data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"MCP server with name '{data.name}' already exists",
        )
    server = await service.create(data)
    return McpServerResponse.model_validate(server)


@router.get(
    "/",
    response_model=list[McpServerResponse],
    summary="List MCP servers",
)
async def list_mcp_servers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: McpService = Depends(_get_service),
) -> list[McpServerResponse]:
    servers = await service.get_all(skip=skip, limit=limit)
    return [McpServerResponse.model_validate(s) for s in servers]


@router.get(
    "/{server_id}",
    response_model=McpServerResponse,
    summary="Get an MCP server by ID",
)
async def get_mcp_server(
    server_id: str,
    service: McpService = Depends(_get_service),
) -> McpServerResponse:
    server = await service.get_by_id(server_id)
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server with id '{server_id}' not found",
        )
    return McpServerResponse.model_validate(server)


@router.patch(
    "/{server_id}",
    response_model=McpServerResponse,
    summary="Update an MCP server",
)
async def update_mcp_server(
    server_id: str,
    data: McpServerUpdate,
    service: McpService = Depends(_get_service),
) -> McpServerResponse:
    if data.name is not None:
        existing = await service.get_by_name(data.name)
        if existing and existing.id != server_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"MCP server with name '{data.name}' already exists",
            )

    try:
        server = await service.update(server_id, data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server with id '{server_id}' not found",
        )
    return McpServerResponse.model_validate(server)


@router.delete(
    "/{server_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an MCP server",
)
async def delete_mcp_server(
    server_id: str,
    service: McpService = Depends(_get_service),
) -> None:
    deleted = await service.delete(server_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server with id '{server_id}' not found",
        )


@router.post(
    "/{server_id}/test",
    response_model=McpTestResult,
    summary="Connect to an MCP server and list the tools it exposes",
)
async def test_mcp_server(
    server_id: str,
    service: McpService = Depends(_get_service),
) -> McpTestResult:
    server = await service.get_by_id(server_id)
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server with id '{server_id}' not found",
        )
    return await service.test_connection(server)

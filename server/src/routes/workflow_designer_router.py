from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.schemas.workflow_designer_schema import DesignRequest, DesignResponse
from src.services.workflow_designer_service import WorkflowDesignerService

router = APIRouter(prefix="/workflow-designer", tags=["Workflow Designer"])


def _get_service(db: AsyncSession = Depends(get_db)) -> WorkflowDesignerService:
    return WorkflowDesignerService(db)


@router.post(
    "/design",
    response_model=DesignResponse,
    summary="Ask the designer to draft or change a workflow",
    description=(
        "Stateless. Send the graph currently on the canvas along with what you "
        "want changed; the reply carries a complete proposed graph, ready to "
        "render and to PUT back to /workflows/{id} unchanged. Nothing is saved "
        "here — conversation history is the caller's to keep and send back."
    ),
)
async def design(
    data: DesignRequest,
    service: WorkflowDesignerService = Depends(_get_service),
) -> DesignResponse:
    try:
        result = await service.design(data)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to get a response from the LLM provider: {exc}",
        ) from exc

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No model with id '{data.llm_model_id}'",
        )
    return result

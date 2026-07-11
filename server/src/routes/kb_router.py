from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.schemas.kb_schema import (
    CollectionCreate,
    CollectionResponse,
    CollectionUpdate,
    DocumentResponse,
    KbSettingsResponse,
    KbSettingsUpdate,
)
from src.services.kb_ingest import ingest_document
from src.services.kb_service import KbService
from src.services.kb_settings_service import KbSettingsService

router = APIRouter(prefix="/kb", tags=["Knowledge Base"])


def _get_service(db: AsyncSession = Depends(get_db)) -> KbService:
    return KbService(db)


def _get_settings_service(db: AsyncSession = Depends(get_db)) -> KbSettingsService:
    return KbSettingsService(db)


@router.get(
    "/settings",
    response_model=KbSettingsResponse,
    summary="Get knowledge-base settings",
)
async def get_settings(
    service: KbSettingsService = Depends(_get_settings_service),
) -> KbSettingsResponse:
    settings = await service.get()
    return KbSettingsResponse.from_model(settings)


@router.put(
    "/settings",
    response_model=KbSettingsResponse,
    summary="Update knowledge-base settings (vector store + embedder)",
)
async def update_settings(
    data: KbSettingsUpdate,
    service: KbSettingsService = Depends(_get_settings_service),
) -> KbSettingsResponse:
    try:
        settings = await service.update(data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )
    return KbSettingsResponse.from_model(settings)


@router.post(
    "/collections",
    response_model=CollectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new collection",
)
async def create_collection(
    data: CollectionCreate,
    service: KbService = Depends(_get_service),
) -> CollectionResponse:
    existing = await service.get_collection_by_name(data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Collection with name '{data.name}' already exists",
        )
    collection = await service.create_collection(data)
    return CollectionResponse.from_model(collection)


@router.get(
    "/collections",
    response_model=list[CollectionResponse],
    summary="List all collections",
)
async def list_collections(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: KbService = Depends(_get_service),
) -> list[CollectionResponse]:
    collections = await service.list_collections(skip=skip, limit=limit)
    return [CollectionResponse.from_model(c) for c in collections]


@router.get(
    "/collections/{collection_id}",
    response_model=CollectionResponse,
    summary="Get a collection by ID",
)
async def get_collection(
    collection_id: str,
    service: KbService = Depends(_get_service),
) -> CollectionResponse:
    collection = await service.get_collection(collection_id)
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Collection with id '{collection_id}' not found",
        )
    return CollectionResponse.from_model(collection)


@router.patch(
    "/collections/{collection_id}",
    response_model=CollectionResponse,
    summary="Update a collection",
)
async def update_collection(
    collection_id: str,
    data: CollectionUpdate,
    service: KbService = Depends(_get_service),
) -> CollectionResponse:
    if data.name is not None:
        existing = await service.get_collection_by_name(data.name)
        if existing and existing.id != collection_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Collection with name '{data.name}' already exists",
            )
    collection = await service.update_collection(collection_id, data)
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Collection with id '{collection_id}' not found",
        )
    return CollectionResponse.from_model(collection)


@router.delete(
    "/collections/{collection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a collection and all its documents/vectors",
)
async def delete_collection(
    collection_id: str,
    service: KbService = Depends(_get_service),
) -> None:
    deleted = await service.delete_collection(collection_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Collection with id '{collection_id}' not found",
        )


@router.post(
    "/collections/{collection_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload a file into a collection (ingested in the background)",
)
async def upload_document(
    collection_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    service: KbService = Depends(_get_service),
) -> DocumentResponse:
    collection = await service.get_collection(collection_id)
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Collection with id '{collection_id}' not found",
        )

    try:
        document = await service.create_document(collection_id, file)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )

    # Ingestion opens its own DB session, so it is safe after the request ends.
    background_tasks.add_task(ingest_document, document.id)
    return DocumentResponse.model_validate(document)


@router.get(
    "/collections/{collection_id}/documents",
    response_model=list[DocumentResponse],
    summary="List documents in a collection",
)
async def list_documents(
    collection_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: KbService = Depends(_get_service),
) -> list[DocumentResponse]:
    collection = await service.get_collection(collection_id)
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Collection with id '{collection_id}' not found",
        )
    documents = await service.list_documents(collection_id, skip=skip, limit=limit)
    return [DocumentResponse.model_validate(d) for d in documents]


@router.get(
    "/documents/{document_id}",
    response_model=DocumentResponse,
    summary="Get a document (including ingestion status) by ID",
)
async def get_document(
    document_id: str,
    service: KbService = Depends(_get_service),
) -> DocumentResponse:
    document = await service.get_document(document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id '{document_id}' not found",
        )
    return DocumentResponse.model_validate(document)


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document and its vectors",
)
async def delete_document(
    document_id: str,
    service: KbService = Depends(_get_service),
) -> None:
    deleted = await service.delete_document(document_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id '{document_id}' not found",
        )

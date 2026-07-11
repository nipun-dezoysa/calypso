import asyncio
import os
import uuid

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings as app_settings
from src.models.kb_collection_model import KbCollection
from src.models.kb_document_model import DocumentStatus, KbDocument
from src.schemas.kb_schema import CollectionCreate, CollectionUpdate
from src.services import kb_vectorstore
from src.services.kb_ingest import SUPPORTED_EXTENSIONS
from src.services.kb_settings_service import KbSettingsService


def _safe_filename(filename: str) -> str:
    """Strip any directory components from a client-supplied filename."""
    return os.path.basename(filename or "").strip() or "upload"


class KbService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Collections ──────────────────────────────────────────────────────

    async def create_collection(self, data: CollectionCreate) -> KbCollection:
        collection = KbCollection(name=data.name, description=data.description)
        self.db.add(collection)
        await self.db.commit()
        await self.db.refresh(collection)
        return collection

    async def get_collection(self, collection_id: str) -> KbCollection | None:
        return await self.db.get(KbCollection, collection_id)

    async def get_collection_by_name(self, name: str) -> KbCollection | None:
        stmt = select(KbCollection).where(KbCollection.name == name)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_collections(
        self, skip: int = 0, limit: int = 100
    ) -> list[KbCollection]:
        stmt = (
            select(KbCollection)
            .order_by(KbCollection.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_collection(
        self, collection_id: str, data: CollectionUpdate
    ) -> KbCollection | None:
        collection = await self.get_collection(collection_id)
        if collection is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(collection, field, value)

        await self.db.commit()
        await self.db.refresh(collection)
        return collection

    async def delete_collection(self, collection_id: str) -> bool:
        """Delete a collection, its documents, their vectors, and stored files."""
        collection = await self.get_collection(collection_id)
        if collection is None:
            return False

        vector_collection_name = collection.vector_collection_name
        cfg = await KbSettingsService(self.db).get_config()

        # Drop the whole vector collection in one shot (best-effort).
        try:
            await asyncio.to_thread(
                kb_vectorstore.delete_collection, cfg, vector_collection_name
            )
        except Exception:  # noqa: BLE001 - never block DB cleanup on vector errors
            pass

        # Remove stored upload files for this collection.
        collection_dir = os.path.join(app_settings.kb_upload_dir, collection_id)
        _remove_dir(collection_dir)

        await self.db.delete(collection)
        await self.db.commit()
        return True

    # ── Documents ────────────────────────────────────────────────────────

    async def create_document(
        self, collection_id: str, upload: UploadFile
    ) -> KbDocument:
        """Persist the uploaded file to disk and create a PENDING document row.
        Ingestion is scheduled separately by the caller."""
        filename = _safe_filename(upload.filename)
        ext = os.path.splitext(filename)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file type '{ext}'. "
                f"Supported: {sorted(SUPPORTED_EXTENSIONS)}"
            )

        document_id = str(uuid.uuid4())
        collection_dir = os.path.join(app_settings.kb_upload_dir, collection_id)
        os.makedirs(collection_dir, exist_ok=True)
        file_path = os.path.join(collection_dir, f"{document_id}_{filename}")

        content = await upload.read()
        with open(file_path, "wb") as f:
            f.write(content)

        document = KbDocument(
            id=document_id,
            collection_id=collection_id,
            filename=filename,
            file_path=file_path,
            content_type=upload.content_type,
            size_bytes=len(content),
            status=DocumentStatus.PENDING.value,
        )
        self.db.add(document)
        await self.db.commit()
        await self.db.refresh(document)
        return document

    async def get_document(self, document_id: str) -> KbDocument | None:
        return await self.db.get(KbDocument, document_id)

    async def list_documents(
        self, collection_id: str, skip: int = 0, limit: int = 100
    ) -> list[KbDocument]:
        stmt = (
            select(KbDocument)
            .where(KbDocument.collection_id == collection_id)
            .order_by(KbDocument.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def delete_document(self, document_id: str) -> bool:
        """Delete a document: remove its vectors, its file, and the DB row."""
        document = await self.get_document(document_id)
        if document is None:
            return False

        collection = await self.db.get(KbCollection, document.collection_id)
        if collection is not None:
            cfg = await KbSettingsService(self.db).get_config()
            try:
                await asyncio.to_thread(
                    kb_vectorstore.delete_document,
                    cfg,
                    collection.vector_collection_name,
                    document_id,
                )
            except Exception:  # noqa: BLE001 - best-effort vector cleanup
                pass

        if document.file_path and os.path.exists(document.file_path):
            try:
                os.remove(document.file_path)
            except OSError:
                pass

        await self.db.delete(document)
        await self.db.commit()
        return True


def _remove_dir(path: str) -> None:
    import shutil

    if os.path.isdir(path):
        try:
            shutil.rmtree(path)
        except OSError:
            pass

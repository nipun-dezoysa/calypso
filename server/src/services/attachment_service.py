import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings as app_settings
from src.models.attachment_model import Attachment, AttachmentStatus
from src.services import attachment_extract
from src.services.attachment_extract import UnsupportedFileError

ORPHAN_MAX_AGE = timedelta(hours=6)


def _safe_filename(filename: str) -> str:
    """Strip any directory components from a client-supplied filename."""
    return os.path.basename(filename or "").strip() or "upload"


class AttachmentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, upload: UploadFile) -> Attachment:
        filename = _safe_filename(upload.filename)
        kind = attachment_extract.kind_for(filename)  # raises UnsupportedFileError

        content = await upload.read()
        if not content:
            raise UnsupportedFileError(f"'{filename}' is empty")
        if len(content) > app_settings.max_attachment_bytes:
            limit_mb = app_settings.max_attachment_bytes / (1024 * 1024)
            raise UnsupportedFileError(
                f"'{filename}' is larger than the {limit_mb:.0f} MB attachment limit"
            )

        attachment_id = str(uuid.uuid4())
        os.makedirs(app_settings.attachment_upload_dir, exist_ok=True)
        file_path = os.path.join(
            app_settings.attachment_upload_dir, f"{attachment_id}_{filename}"
        )
        with open(file_path, "wb") as f:
            f.write(content)

        status = AttachmentStatus.COMPLETED.value
        extracted_text: str | None = None
        error_message: str | None = None
        try:
            extracted_text = await asyncio.to_thread(
                attachment_extract.extract_text, file_path, filename
            )
        except Exception as exc:  # noqa: BLE001 - a bad file must not 500 the upload
            status = AttachmentStatus.FAILED.value
            error_message = str(exc)[:2000]

        attachment = Attachment(
            id=attachment_id,
            filename=filename,
            file_path=file_path,
            content_type=upload.content_type,
            size_bytes=len(content),
            kind=kind,
            status=status,
            extracted_text=extracted_text or None,
            error_message=error_message,
        )
        self.db.add(attachment)
        await self.db.commit()
        await self.db.refresh(attachment)
        return attachment

    async def get(self, attachment_id: str) -> Attachment | None:
        return await self.db.get(Attachment, attachment_id)

    async def get_unsent(self, attachment_ids: list[str]) -> list[Attachment]:
        if not attachment_ids:
            return []

        stmt = select(Attachment).where(
            Attachment.id.in_(attachment_ids),
            Attachment.message_id.is_(None),
        )
        result = await self.db.execute(stmt)
        by_id = {a.id: a for a in result.scalars().all()}
        return [by_id[i] for i in attachment_ids if i in by_id]

    async def delete(self, attachment_id: str) -> bool:
        attachment = await self.db.get(Attachment, attachment_id)
        if attachment is None:
            return False

        remove_file(attachment.file_path)
        await self.db.delete(attachment)
        await self.db.commit()
        return True

    async def purge_orphans(self) -> None:
        cutoff = datetime.now(timezone.utc) - ORPHAN_MAX_AGE
        stmt = select(Attachment).where(
            Attachment.message_id.is_(None),
            Attachment.created_at < cutoff,
        )
        result = await self.db.execute(stmt)
        orphans = list(result.scalars().all())
        if not orphans:
            return

        for orphan in orphans:
            remove_file(orphan.file_path)
            await self.db.delete(orphan)
        await self.db.commit()


def remove_file(file_path: str | None) -> None:
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError:
            pass

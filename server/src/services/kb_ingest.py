import asyncio
import os

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import settings as app_settings
from src.database import async_session
from src.models.kb_collection_model import KbCollection
from src.models.kb_document_model import DocumentStatus, KbDocument
from src.models.kb_settings_model import SETTINGS_SINGLETON_ID, KbSettings
from src.services import kb_vectorstore
from src.services.kb_vectorstore import KbConfig

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md", ".markdown"}


def _load_file(file_path: str) -> list[Document]:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"The file {file_path} does not exist.")

    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        from langchain_community.document_loaders import PyPDFLoader

        return PyPDFLoader(file_path).load()
    if ext in {".txt", ".md", ".markdown"}:
        from langchain_community.document_loaders import TextLoader

        return TextLoader(file_path, encoding="utf-8", autodetect_encoding=True).load()

    raise ValueError(
        f"Unsupported file type '{ext}'. Supported: {sorted(SUPPORTED_EXTENSIONS)}"
    )


def _process_to_vectorstore(
    cfg: KbConfig,
    collection_name: str,
    file_path: str,
    document_id: str,
    collection_id: str,
) -> int:
    """Blocking pipeline: load → split → tag metadata → embed → index.
    Returns the number of chunks indexed. Runs in a worker thread."""
    docs = _load_file(file_path)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
    )
    chunks = splitter.split_documents(docs)

    # Tag every chunk so we can later delete a single document's vectors.
    for chunk in chunks:
        chunk.metadata["document_id"] = document_id
        chunk.metadata["collection_id"] = collection_id

    if chunks:
        kb_vectorstore.add_documents(cfg, collection_name, chunks)
    return len(chunks)


async def ingest_document(document_id: str) -> None:
    """Load, chunk, embed and index a document, updating its status as it goes.
    Errors are captured on the document row rather than raised."""
    async with async_session() as db:
        document = await db.get(KbDocument, document_id)
        if document is None:
            return

        collection = await db.get(KbCollection, document.collection_id)
        if collection is None:
            document.status = DocumentStatus.FAILED.value
            document.error_message = "Parent collection no longer exists"
            await db.commit()
            return

        settings_row = await db.get(KbSettings, SETTINGS_SINGLETON_ID)
        if settings_row is None:
            settings_row = KbSettings(id=SETTINGS_SINGLETON_ID)
            db.add(settings_row)
            await db.commit()
            await db.refresh(settings_row)

        cfg = KbConfig.from_settings(settings_row, app_settings.chroma_persist_dir)
        collection_name = collection.vector_collection_name
        file_path = document.file_path
        collection_id = document.collection_id

        document.status = DocumentStatus.PROCESSING.value
        await db.commit()

        try:
            chunk_count = await asyncio.to_thread(
                _process_to_vectorstore,
                cfg,
                collection_name,
                file_path,
                document_id,
                collection_id,
            )
        except Exception as exc:  # noqa: BLE001 - persist failure, don't crash task
            document.status = DocumentStatus.FAILED.value
            document.error_message = str(exc)[:2000]
            await db.commit()
            return

        document.status = DocumentStatus.COMPLETED.value
        document.chunk_count = chunk_count
        document.error_message = None
        await db.commit()

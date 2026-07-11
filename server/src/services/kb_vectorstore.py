from dataclasses import dataclass

from langchain_core.embeddings import Embeddings
from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStore

from config import require_env
from src.models.kb_settings_model import KbSettings

DEFAULT_FASTEMBED_MODEL = "BAAI/bge-small-en-v1.5"
DEFAULT_NOMIC_MODEL = "nomic-embed-text-v1.5"


@dataclass(frozen=True)
class KbConfig:
    """Immutable snapshot of KB settings used to build embedders/vector stores."""

    vector_db_provider: str
    qdrant_url: str | None
    qdrant_api_key: str | None
    embedding_provider: str
    embedding_model: str | None
    nomic_api_key: str | None
    chroma_persist_dir: str

    @classmethod
    def from_settings(cls, settings: KbSettings, chroma_persist_dir: str) -> "KbConfig":
        return cls(
            vector_db_provider=settings.vector_db_provider,
            qdrant_url=settings.qdrant_url,
            qdrant_api_key=settings.qdrant_api_key,
            embedding_provider=settings.embedding_provider,
            embedding_model=settings.embedding_model,
            nomic_api_key=settings.nomic_api_key,
            chroma_persist_dir=chroma_persist_dir,
        )


def build_embeddings(cfg: KbConfig) -> Embeddings:
    provider = cfg.embedding_provider.lower()

    if provider == "fastembed":
        from langchain_community.embeddings import FastEmbedEmbeddings

        return FastEmbedEmbeddings(
            model_name=cfg.embedding_model or DEFAULT_FASTEMBED_MODEL,
        )

    if provider == "nomic":
        from langchain_nomic import NomicEmbeddings

        return NomicEmbeddings(
            model=cfg.embedding_model or DEFAULT_NOMIC_MODEL,
            nomic_api_key=require_env(cfg.nomic_api_key, "nomic_api_key"),
        )

    raise ValueError(
        f"Unsupported embedding_provider '{cfg.embedding_provider}'. "
        "Supported values: fastembed, nomic"
    )


def get_vector_store(cfg: KbConfig, collection_name: str) -> VectorStore:
    provider = cfg.vector_db_provider.lower()
    embeddings = build_embeddings(cfg)

    if provider == "chroma":
        from langchain_chroma import Chroma

        return Chroma(
            collection_name=collection_name,
            embedding_function=embeddings,
            persist_directory=cfg.chroma_persist_dir,
        )

    if provider == "qdrant":
        from langchain_qdrant import QdrantVectorStore

        return QdrantVectorStore.from_existing_collection(
            embedding=embeddings,
            collection_name=collection_name,
            url=require_env(cfg.qdrant_url, "qdrant_url"),
            api_key=cfg.qdrant_api_key,
        )

    raise ValueError(_unsupported_vector_db(cfg))


def add_documents(
    cfg: KbConfig,
    collection_name: str,
    documents: list[Document],
) -> None:
    provider = cfg.vector_db_provider.lower()
    embeddings = build_embeddings(cfg)

    if provider == "chroma":
        from langchain_chroma import Chroma

        store = Chroma(
            collection_name=collection_name,
            embedding_function=embeddings,
            persist_directory=cfg.chroma_persist_dir,
        )
        store.add_documents(documents)
        return

    if provider == "qdrant":
        from langchain_qdrant import QdrantVectorStore
        QdrantVectorStore.from_documents(
            documents=documents,
            embedding=embeddings,
            collection_name=collection_name,
            url=require_env(cfg.qdrant_url, "qdrant_url"),
            api_key=cfg.qdrant_api_key,
        )
        return

    raise ValueError(_unsupported_vector_db(cfg))


def delete_document(cfg: KbConfig, collection_name: str, document_id: str) -> None:
    provider = cfg.vector_db_provider.lower()

    if provider == "chroma":
        from langchain_chroma import Chroma

        store = Chroma(
            collection_name=collection_name,
            embedding_function=build_embeddings(cfg),
            persist_directory=cfg.chroma_persist_dir,
        )
        store.delete(where={"document_id": document_id})
        return

    if provider == "qdrant":
        from qdrant_client import QdrantClient, models
        from qdrant_client.http.exceptions import UnexpectedResponse

        client = QdrantClient(
            url=require_env(cfg.qdrant_url, "qdrant_url"),
            api_key=cfg.qdrant_api_key,
        )
        try:
            if client.collection_exists(collection_name=collection_name):
                client.delete(
                    collection_name=collection_name,
                    points_selector=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="metadata.document_id",
                                match=models.MatchValue(value=document_id),
                            ),
                        ],
                    ),
                )
        except UnexpectedResponse:
            pass
        return

    raise ValueError(_unsupported_vector_db(cfg))


def delete_collection(cfg: KbConfig, collection_name: str) -> None:
    provider = cfg.vector_db_provider.lower()

    if provider == "chroma":
        from langchain_chroma import Chroma

        store = Chroma(
            collection_name=collection_name,
            embedding_function=build_embeddings(cfg),
            persist_directory=cfg.chroma_persist_dir,
        )
        store.delete_collection()
        return

    if provider == "qdrant":
        from qdrant_client import QdrantClient
        from qdrant_client.http.exceptions import UnexpectedResponse

        client = QdrantClient(
            url=require_env(cfg.qdrant_url, "qdrant_url"),
            api_key=cfg.qdrant_api_key,
        )
        try:
            client.delete_collection(collection_name=collection_name)
        except UnexpectedResponse:
            pass
        return

    raise ValueError(_unsupported_vector_db(cfg))


def _unsupported_vector_db(cfg: KbConfig) -> str:
    return (
        f"Unsupported vector_db_provider '{cfg.vector_db_provider}'. "
        "Supported values: chroma, qdrant"
    )

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")
load_dotenv(dotenv_path=".env.local", override=True)


def _get_bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _get_int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return int(value)


def _get_list_env(name: str, default: list[str]) -> list[str]:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


def require_env(value: str | None, env_name: str) -> str:
    if value is None or value.strip() == "":
        raise ValueError(f"{env_name} environment variable is not set.")
    return value


@dataclass(frozen=True)
class Settings:
    cors_origins: list[str]
    cors_origin_regex: str | None
    kb_upload_dir: str
    attachment_upload_dir: str
    max_attachment_bytes: int
    chroma_persist_dir: str
    static_dir: str
    jwt_secret: str | None
    jwt_algorithm: str
    jwt_expire_days: int
    default_username: str
    default_password: str
    history_token_budget: int


settings = Settings(
    cors_origins=_get_list_env(
        "CORS_ORIGINS",
        default=["http://localhost:5173", "http://127.0.0.1:5173"],
    ),
    cors_origin_regex=os.getenv(
        "CORS_ORIGIN_REGEX",
        r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    ),
    kb_upload_dir=os.getenv("KB_UPLOAD_DIR", "kb_files"),
    attachment_upload_dir=os.getenv("ATTACHMENT_UPLOAD_DIR", "attachment_files"),
    max_attachment_bytes=_get_int_env("MAX_ATTACHMENT_BYTES", 20 * 1024 * 1024),
    chroma_persist_dir=os.getenv("CHROMA_PERSIST_DIR", "chroma_db"),
    static_dir=os.getenv("STATIC_DIR", "static"),
    jwt_secret=os.getenv("JWT_SECRET") or None,
    jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
    jwt_expire_days=_get_int_env("JWT_EXPIRE_DAYS", 365),
    default_username=os.getenv("DEFAULT_USERNAME", "admin"),
    default_password=os.getenv("DEFAULT_PASSWORD", "admin"),
    history_token_budget=_get_int_env("HISTORY_TOKEN_BUDGET", 6000),
)

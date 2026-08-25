import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from src.database import async_session
from src.models.app_secret_model import AppSecret
from src.models.user_model import User
from src.schemas.auth_schema import CredentialsUpdate

_JWT_SECRET_KEY = "jwt_secret"

# Resolved once at startup by `bootstrap_auth`, then reused for every request.
_signing_secret: str | None = None


class InvalidCredentialsError(Exception):
    """The supplied password did not match."""


class UsernameTakenError(Exception):
    """Another account already uses the requested username."""


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False  # stored hash is malformed; treat as no match


def credentials_fingerprint(password_hash: str) -> str:
    """Short digest of the stored hash, embedded in every token. Changing the
    password changes the digest, which retires tokens minted before the change
    including the ones handed out while the default password was still live."""
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def get_signing_secret() -> str:
    if _signing_secret is None:
        raise RuntimeError("auth is not bootstrapped; call bootstrap_auth() first")
    return _signing_secret


def token_lifetime() -> timedelta:
    return timedelta(days=settings.jwt_expire_days)


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "username": user.username,
        "fp": credentials_fingerprint(user.password_hash),
        "iat": now,
        "exp": now + token_lifetime(),
    }
    return jwt.encode(payload, get_signing_secret(), algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Raises jwt.PyJWTError when the token is expired, tampered with, or signed
    with a different secret."""
    return jwt.decode(
        token,
        get_signing_secret(),
        algorithms=[settings.jwt_algorithm],
    )


async def bootstrap_auth() -> None:
    """Resolve the signing secret and seed the default account. Safe to re-run."""
    global _signing_secret

    async with async_session() as db:
        if settings.jwt_secret:
            _signing_secret = settings.jwt_secret
        else:
            _signing_secret = await _load_or_create_secret(db)

        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none() is None:
            db.add(
                User(
                    username=settings.default_username,
                    password_hash=hash_password(settings.default_password),
                    must_change_credentials=True,
                )
            )
            await db.commit()


async def _load_or_create_secret(db: AsyncSession) -> str:
    existing = await db.get(AppSecret, _JWT_SECRET_KEY)
    if existing:
        return existing.value

    secret = secrets.token_urlsafe(48)
    db.add(AppSecret(key=_JWT_SECRET_KEY, value=secret))
    await db.commit()
    return secret


class AuthService:
    """Service layer for authentication and credential management."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: str) -> User | None:
        return await self.db.get(User, user_id)

    async def get_by_username(self, username: str) -> User | None:
        result = await self.db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def authenticate(self, username: str, password: str) -> User | None:
        user = await self.get_by_username(username)
        if user is None or not verify_password(password, user.password_hash):
            return None
        return user

    async def update_credentials(self, user: User, data: CredentialsUpdate) -> User:
        if not verify_password(data.current_password, user.password_hash):
            raise InvalidCredentialsError("current password is incorrect")

        if data.username and data.username != user.username:
            taken = await self.get_by_username(data.username)
            if taken is not None:
                raise UsernameTakenError(
                    f"username '{data.username}' is already taken"
                )
            user.username = data.username

        if data.new_password:
            user.password_hash = hash_password(data.new_password)

        user.must_change_credentials = False
        await self.db.commit()
        await self.db.refresh(user)
        return user

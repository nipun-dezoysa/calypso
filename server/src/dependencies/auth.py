import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models.user_model import User
from src.services.auth_service import (
    AuthService,
    credentials_fingerprint,
    decode_access_token,
)

bearer_scheme = HTTPBearer(auto_error=False)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise _UNAUTHORIZED

    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise _UNAUTHORIZED from exc

    user_id = payload.get("sub")
    if not user_id:
        raise _UNAUTHORIZED

    user = await AuthService(db).get_by_id(user_id)
    if user is None:
        raise _UNAUTHORIZED

    # Credentials changed since this token was issued, so it no longer counts.
    if payload.get("fp") != credentials_fingerprint(user.password_hash):
        raise _UNAUTHORIZED

    return user


async def require_auth(_user: User = Depends(get_current_user)) -> None:
    """Router-level guard for endpoints that only need "someone is logged in"."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.dependencies.auth import get_current_user
from src.models.user_model import User
from src.schemas.auth_schema import (
    CredentialsUpdate,
    LoginRequest,
    TokenResponse,
    UserResponse,
)
from src.services.auth_service import (
    AuthService,
    InvalidCredentialsError,
    UsernameTakenError,
    create_access_token,
    token_lifetime,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _get_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(db)


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user),
        expires_in=int(token_lifetime().total_seconds()),
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Exchange username and password for an access token",
)
async def login(
    data: LoginRequest,
    service: AuthService = Depends(_get_service),
) -> TokenResponse:
    user = await service.authenticate(data.username, data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _token_response(user)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the signed-in user",
)
async def read_me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(user)


@router.put(
    "/credentials",
    response_model=TokenResponse,
    summary="Change username and/or password",
)
async def update_credentials(
    data: CredentialsUpdate,
    user: User = Depends(get_current_user),
    service: AuthService = Depends(_get_service),
) -> TokenResponse:
    try:
        updated = await service.update_credentials(user, data)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc
    except UsernameTakenError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc

    # The old token is dead the moment the password hash changes, so hand back
    # a fresh one and keep the user signed in.
    return _token_response(updated)

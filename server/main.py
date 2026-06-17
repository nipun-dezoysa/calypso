from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from src.database import engine, init_db
from src.routes.ai_provider_router import router as ai_provider_router

import src.models


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(title="Calypso Server", version="1.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(ai_provider_router, prefix="/api/v1")

    return app


app = create_app()
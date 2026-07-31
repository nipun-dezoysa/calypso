from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from src.database import engine, init_db
from src.routes.agent_router import router as agent_router
from src.routes.ai_provider_router import router as ai_provider_router
from src.routes.chat_router import router as chat_router
from src.routes.kb_router import router as kb_router
from src.routes.mcp_router import router as mcp_router
from src.routes.workflow_router import router as workflow_router

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
    app.include_router(agent_router, prefix="/api/v1")
    app.include_router(chat_router, prefix="/api/v1")
    app.include_router(kb_router, prefix="/api/v1")
    app.include_router(mcp_router, prefix="/api/v1")
    app.include_router(workflow_router, prefix="/api/v1")

    static_dir = Path(settings.static_dir)
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")

    return app


app = create_app()
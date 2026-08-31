from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import settings
from src.database import engine, init_db
from src.dependencies.auth import require_auth
from src.dependencies.rate_limit import limiter
from src.routes.agent_router import router as agent_router
from src.routes.ai_provider_router import router as ai_provider_router
from src.routes.auth_router import router as auth_router
from src.routes.chat_router import router as chat_router
from src.routes.graph_db_router import router as graph_db_router
from src.routes.kb_router import router as kb_router
from src.routes.mcp_router import router as mcp_router
from src.routes.workflow_designer_router import router as workflow_designer_router
from src.routes.workflow_router import router as workflow_router
from src.services.auth_service import bootstrap_auth
from src.services.graph_client import close_all as close_graph_drivers

import src.models


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    await bootstrap_auth()
    yield
    await close_graph_drivers()
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(title="Calypso Server", version="1.0.0", lifespan=lifespan)

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router, prefix="/api/v1")

    # Everything that reads or edits configuration is behind a bearer token.
    protected = [Depends(require_auth)]
    app.include_router(ai_provider_router, prefix="/api/v1", dependencies=protected)
    app.include_router(agent_router, prefix="/api/v1", dependencies=protected)
    app.include_router(kb_router, prefix="/api/v1", dependencies=protected)
    app.include_router(mcp_router, prefix="/api/v1", dependencies=protected)
    app.include_router(graph_db_router, prefix="/api/v1", dependencies=protected)
    app.include_router(workflow_router, prefix="/api/v1", dependencies=protected)
    app.include_router(workflow_designer_router, prefix="/api/v1", dependencies=protected)

    # Chat guards its own routes: /chat/{id}/ask stays public so other
    # applications can call it, the thread/history routes do not.
    app.include_router(chat_router, prefix="/api/v1")

    static_dir = Path(settings.static_dir)
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")

    return app


app = create_app()
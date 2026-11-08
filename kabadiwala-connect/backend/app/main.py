from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (register tables)
from .config import settings
from .database import Base, SessionLocal, engine
from .routers import admin_routes, analytics_routes, auth_routes, common_routes, market_routes, requests_routes

if settings.app_env == "production" and settings.auth_mode != "firebase":
    raise RuntimeError("AUTH_MODE must be 'firebase' when APP_ENV=production")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Development convenience. Replace with Alembic migrations before any real deployment.
    Base.metadata.create_all(bind=engine)
    if settings.seed_demo and settings.app_env != "production":
        from .seed import seed_demo_data

        with SessionLocal() as db:
            seed_demo_data(db)
    yield


app = FastAPI(title="Kabadiwala Connect API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router_module in (auth_routes, requests_routes, market_routes, common_routes, admin_routes, analytics_routes):
    app.include_router(router_module.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "auth_mode": settings.auth_mode}

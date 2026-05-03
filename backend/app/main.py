from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db
from app.routers import auth, materials, tests, predictions, reports, websockets


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Pre-load ML models
    from app.ml.models import get_strength_model, get_anomaly_model
    get_strength_model()
    get_anomaly_model()
    yield


app = FastAPI(
    title="MatTest API — Plateforme Intelligente d'Essais Matériaux",
    description="API REST + WebSocket pour la gestion, l'analyse ML et la certification des essais de matériaux de construction (béton, acier, bitume). Normes EN 12390 / ASTM C39 / ISO 1920.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth.router, prefix="/api")
app.include_router(materials.router, prefix="/api")
app.include_router(tests.router, prefix="/api")
app.include_router(predictions.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

# WebSocket routes (no /api prefix — nginx proxies /ws/ directly)
app.include_router(websockets.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}

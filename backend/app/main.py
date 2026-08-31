from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.services.rule_engine import start_rule_engine, stop_rule_engine
from app.services.ai_engine import start_ai_engine, stop_ai_engine
from app.models.schemas import HealthResponse

# Routers
from app.api.auth import router as auth_router
from app.api.metrics import router as metrics_router
from app.api.nodes import router as nodes_router
from app.api.logs import router as logs_router
from app.api.alerts import router as alerts_router
from app.api.clusters import router as clusters_router
from app.api.config import router as config_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[Server] Starting K8s Monitoring FastAPI Backend on port", settings.PORT)
    try:
        await connect_to_mongo()
    except Exception as e:
        print(f"[Server] Warning: Mongo connection error at boot: {e}")

    # Start background rule evaluation loop
    start_rule_engine()

    # Start background AI analysis loop if enabled
    start_ai_engine()

    yield

    # Shutdown
    print("[Server] Shutting down FastAPI Backend...")
    stop_ai_engine()
    stop_rule_engine()
    await close_mongo_connection()


app = FastAPI(
    title="K8s Monitoring Tool API",
    description="FastAPI Backend for Kubernetes Observability & Multi-Cluster Control Plane",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware (matching Express cors configuration)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency-free Health Check / Liveness Probe
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    return HealthResponse(status="ok")


# Mount API Routers
app.include_router(auth_router)
app.include_router(metrics_router)
app.include_router(nodes_router)
app.include_router(logs_router)
app.include_router(alerts_router)
app.include_router(clusters_router)
app.include_router(config_router)


from fastapi import APIRouter, Depends
from app.config import settings
from app.core.security import get_current_user
from app.models.schemas import AppConfigResponse

router = APIRouter(prefix="/api/config", tags=["Config"])


@router.get("", response_model=AppConfigResponse)
@router.get("/", response_model=AppConfigResponse)
async def get_app_config(user: dict = Depends(get_current_user)):
    return AppConfigResponse(
        ai_enabled=settings.AI_ENABLED,
        ai_provider=settings.AI_PROVIDER if settings.AI_ENABLED else None,
        ai_model=settings.AI_MODEL if settings.AI_ENABLED else None,
    )

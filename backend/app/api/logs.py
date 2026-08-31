from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from app.core.security import get_current_user
from app.models.schemas import LogEntry
from app.services.loki import fetch_pod_logs

router = APIRouter(prefix="/api/logs", tags=["Logs"])


@router.get("", response_model=List[LogEntry])
@router.get("/", response_model=List[LogEntry])
async def get_logs(
    pod: str = Query(..., description="Pod name"),
    limit: Optional[int] = Query(100, description="Log line limit"),
    user: dict = Depends(get_current_user),
):
    if not pod:
        raise HTTPException(status_code=400, detail="pod query param is required")

    limit_val = 100 if not limit or limit <= 0 else limit
    try:
        return await fetch_pod_logs(pod, limit_val)
    except Exception as err:
        print(f"[API /api/logs] Error for {pod}: {err}")
        return []

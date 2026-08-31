from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.security import get_current_user
from app.models.schemas import PodMetric, MetricHistoryPoint
from app.services.prometheus import fetch_pod_metrics_summary, fetch_metric_history

router = APIRouter(prefix="/api/metrics", tags=["Metrics"])


@router.get("/summary", response_model=List[PodMetric])
async def get_metrics_summary(user: dict = Depends(get_current_user)):
    try:
        return await fetch_pod_metrics_summary()
    except Exception as err:
        print(f"[API /api/metrics/summary] Error: {err}")
        return []


@router.get("/history", response_model=List[MetricHistoryPoint])
async def get_metric_history(
    metric: str = Query(..., description="cpu or memory"),
    pod: str = Query(..., description="Pod name"),
    minutes: Optional[int] = Query(15, description="Minutes to query"),
    user: dict = Depends(get_current_user),
):
    if metric not in ["cpu", "memory"]:
        raise HTTPException(status_code=400, detail="invalid metric")

    if not pod:
        raise HTTPException(status_code=400, detail="pod parameter is required")

    minutes_val = 15 if not minutes or minutes <= 0 else minutes
    try:
        return await fetch_metric_history(metric, pod, minutes_val)
    except Exception as err:
        print(f"[API /api/metrics/history] Error for {pod}: {err}")
        return []

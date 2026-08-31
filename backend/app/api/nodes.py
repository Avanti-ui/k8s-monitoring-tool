from typing import List
from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.models.schemas import NodeMetric
from app.services.prometheus import fetch_node_metrics_summary

router = APIRouter(prefix="/api/nodes", tags=["Nodes"])


@router.get("", response_model=List[NodeMetric])
@router.get("/", response_model=List[NodeMetric])
async def get_nodes(user: dict = Depends(get_current_user)):
    try:
        return await fetch_node_metrics_summary()
    except Exception as err:
        print(f"[API /api/nodes] Error: {err}")
        return []

from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.database import get_database
from app.core.security import get_current_user
from app.models.schemas import AlertItem

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


def format_alert_item(doc: dict) -> AlertItem:
    created_at = doc.get("created_at")
    if isinstance(created_at, datetime):
        created_str = created_at.isoformat()
    elif isinstance(created_at, str):
        created_str = created_at
    else:
        created_str = datetime.now(timezone.utc).isoformat()

    return AlertItem(
        id=str(doc.get("_id", "")),
        pod=doc.get("pod", "unknown"),
        namespace=doc.get("namespace", "default"),
        rule=doc.get("rule", "unknown"),
        severity=doc.get("severity", "warning"),
        message=doc.get("message", ""),
        status=doc.get("status", "active"),
        created_at=created_str,
        acknowledged=bool(doc.get("acknowledged", False)),
        source=doc.get("source", "rule"),
        likely_root_cause=doc.get("likely_root_cause"),
        recommended_action=doc.get("recommended_action"),
    )



@router.get("", response_model=List[AlertItem])
@router.get("/", response_model=List[AlertItem])
async def get_alerts(
    status: Optional[str] = Query(None, description="active or resolved"),
    limit: Optional[int] = Query(50, description="Limit of alerts"),
    user: dict = Depends(get_current_user),
):
    query = {}
    if status in ["active", "resolved"]:
        query["status"] = status

    limit_val = 50 if not limit or limit <= 0 else min(limit, 500)
    db = get_database()

    cursor = db["alerts"].find(query).sort("created_at", -1).limit(limit_val)
    docs = await cursor.to_list(length=limit_val)
    return [format_alert_item(d) for d in docs]


@router.post("/{id}/acknowledge", response_model=AlertItem)
async def acknowledge_alert(
    id: str,
    user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=404, detail="not found")

    db = get_database()
    alert_id = ObjectId(id)

    updated = await db["alerts"].find_one_and_update(
        {"_id": alert_id},
        {"$set": {"acknowledged": True}},
        return_document=True,
    )

    if not updated:
        raise HTTPException(status_code=404, detail="not found")

    return format_alert_item(updated)

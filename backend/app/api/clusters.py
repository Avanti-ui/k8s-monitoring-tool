from typing import List
from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.models.schemas import DiscoveredCluster, RescanResponse
from app.services.cluster_discovery import ClusterDiscoveryService

router = APIRouter(prefix="/api/clusters", tags=["Clusters"])


@router.get("", response_model=List[DiscoveredCluster])
@router.get("/", response_model=List[DiscoveredCluster])
async def get_clusters(user: dict = Depends(get_current_user)):
    discovery = ClusterDiscoveryService.get_instance()
    return await discovery.get_clusters()


@router.post("/rescan", response_model=RescanResponse)
async def rescan_clusters(user: dict = Depends(get_current_user)):
    discovery = ClusterDiscoveryService.get_instance()
    clusters = await discovery.discover_clusters()
    return RescanResponse(
        message="Clusters rescanned successfully",
        count=len(clusters),
        clusters=clusters,
    )

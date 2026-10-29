"""
Grafana Loki log ingestion and query service.
Queries Loki logQL endpoints to retrieve recent container logs and error traces for target pods.
Includes fallback logic to query the Kubernetes CoreV1 API directly if Loki is unavailable.
"""

import asyncio
import time
from datetime import datetime
import httpx
from typing import List
from app.config import settings
from app.models.schemas import LogEntry


def _fetch_k8s_direct_logs(pod: str, limit: int = 100) -> List[LogEntry]:
    try:
        from kubernetes import client, config
        try:
            config.load_incluster_config()
        except Exception:
            try:
                config.load_kube_config()
            except Exception:
                return []

        v1 = client.CoreV1Api()
        pods = v1.list_pod_for_all_namespaces(watch=False)
        target_name = None
        target_namespace = None
        for p in pods.items:
            if p.metadata.name == pod:
                target_name = p.metadata.name
                target_namespace = p.metadata.namespace
                break
            elif pod in p.metadata.name and not target_name:
                target_name = p.metadata.name
                target_namespace = p.metadata.namespace

        if not target_name or not target_namespace:
            return []

        raw = v1.read_namespaced_pod_log(
            name=target_name,
            namespace=target_namespace,
            tail_lines=limit,
            timestamps=True,
        )

        entries: List[LogEntry] = []
        for line in raw.strip().split("\n"):
            line = line.strip()
            if not line:
                continue

            parts = line.split(" ", 1)
            iso_str = parts[0]
            log_msg = parts[1] if len(parts) > 1 else line

            unix_ms = int(time.time() * 1000)
            try:
                cleaned_iso = iso_str
                if "T" in cleaned_iso and cleaned_iso.endswith("Z"):
                    base, rest = cleaned_iso.split("T")
                    if "." in rest:
                        sec_part, frac = rest[:-1].split(".", 1)
                        frac = frac[:6]
                        cleaned_iso = f"{base}T{sec_part}.{frac}+00:00"
                    else:
                        cleaned_iso = f"{base}T{rest[:-1]}+00:00"
                dt = datetime.fromisoformat(cleaned_iso)
                unix_ms = int(dt.timestamp() * 1000)
            except Exception:
                log_msg = line

            entries.append(LogEntry(timestamp=unix_ms, line=log_msg))

        entries.sort(key=lambda x: x.timestamp, reverse=True)
        return entries[:limit]
    except Exception as err:
        print(f"[K8sDirectLogs] Error querying logs for {pod}: {err}")
        return []


async def fetch_pod_logs(pod: str, limit: int = 100) -> List[LogEntry]:
    capped_limit = min(max(1, limit), 500)
    base_url = settings.LOKI_URL.rstrip("/")
    query = f'{{pod=~".*{pod}.*"}}'
    url = f"{base_url}/loki/api/v1/query_range"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                url,
                params={
                    "query": query,
                    "limit": capped_limit,
                    "direction": "BACKWARD",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                if data and data.get("data") and data["data"].get("result"):
                    all_entries: List[LogEntry] = []
                    for stream in data["data"]["result"]:
                        for val in stream.get("values", []):
                            if len(val) >= 2:
                                nano_ts, line = val[0], val[1]
                                try:
                                    if len(str(nano_ts)) > 6:
                                        unix_ms = int(int(nano_ts) // 1_000_000)
                                    else:
                                        unix_ms = int(nano_ts)
                                except Exception:
                                    unix_ms = int(time.time() * 1000)

                                all_entries.append(LogEntry(timestamp=unix_ms, line=line))

                    if all_entries:
                        all_entries.sort(key=lambda x: x.timestamp, reverse=True)
                        return all_entries[:capped_limit]
    except Exception as err:
        print(f"[Loki] Error querying logs for {pod}: {err}")

    # Fallback to direct Kubernetes API log streaming
    return await asyncio.to_thread(_fetch_k8s_direct_logs, pod, capped_limit)


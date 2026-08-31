import time
import httpx
from typing import List
from app.config import settings
from app.models.schemas import LogEntry


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
            if resp.status_code != 200:
                return []

            data = resp.json()
            if not data or not data.get("data") or not data["data"].get("result"):
                return []

            all_entries: List[LogEntry] = []
            for stream in data["data"]["result"]:
                for val in stream.get("values", []):
                    if len(val) >= 2:
                        nano_ts, line = val[0], val[1]
                        try:
                            # Convert nanoseconds to milliseconds
                            if len(str(nano_ts)) > 6:
                                unix_ms = int(int(nano_ts) // 1_000_000)
                            else:
                                unix_ms = int(nano_ts)
                        except Exception:
                            unix_ms = int(time.time() * 1000)

                        all_entries.append(LogEntry(timestamp=unix_ms, line=line))

            all_entries.sort(key=lambda x: x.timestamp, reverse=True)
            return all_entries[:capped_limit]
    except Exception as err:
        print(f"[Loki] Error querying logs for {pod}: {err}")
        return []

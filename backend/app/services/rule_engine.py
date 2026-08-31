import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Set
from bson import ObjectId
from app.config import settings
from app.core.database import get_database
from app.services.prometheus import fetch_pod_metrics_summary, fetch_node_metrics_summary
from app.services.slack import send_slack_alert

# In-memory tracker for pod restart counts: podKey -> last restart count
last_restart_counts: Dict[str, int] = {}
is_engine_running = False
rule_engine_task: asyncio.Task | None = None


async def run_rule_evaluation():
    try:
        pods = await fetch_pod_metrics_summary()
        nodes = await fetch_node_metrics_summary()
        db = get_database()

        fired_conditions: List[dict] = []

        # 1. Evaluate Pod Metrics
        for pod in pods:
            if settings.EXCLUDE_SYSTEM_NAMESPACES and pod.namespace in settings.IGNORED_NAMESPACES:
                continue

            pod_key = f"{pod.namespace}/{pod.pod}"


            # CPU Thresholds
            if pod.cpu_percent > 95:
                fired_conditions.append({
                    "pod": pod.pod,
                    "namespace": pod.namespace,
                    "rule": "high-cpu",
                    "severity": "critical",
                    "message": f"{pod.cpu_percent}% CPU utilization",
                })
            elif pod.cpu_percent > 80:
                fired_conditions.append({
                    "pod": pod.pod,
                    "namespace": pod.namespace,
                    "rule": "high-cpu",
                    "severity": "warning",
                    "message": f"{pod.cpu_percent}% CPU utilization",
                })

            # Memory Thresholds
            if pod.memory_percent > 95:
                fired_conditions.append({
                    "pod": pod.pod,
                    "namespace": pod.namespace,
                    "rule": "high-memory",
                    "severity": "critical",
                    "message": f"{pod.memory_percent}% Memory utilization",
                })
            elif pod.memory_percent > 85:
                fired_conditions.append({
                    "pod": pod.pod,
                    "namespace": pod.namespace,
                    "rule": "high-memory",
                    "severity": "warning",
                    "message": f"{pod.memory_percent}% Memory utilization",
                })

            # CrashLoop Detection
            if pod_key in last_restart_counts:
                prev_count = last_restart_counts[pod_key]
                if pod.restart_count > prev_count:
                    fired_conditions.append({
                        "pod": pod.pod,
                        "namespace": pod.namespace,
                        "rule": "crash-loop",
                        "severity": "critical",
                        "message": f"Pod restarted ({pod.restart_count} total restarts)",
                    })
            last_restart_counts[pod_key] = pod.restart_count

        # 2. Evaluate Node Statuses
        for node in nodes:
            if node.status != "Ready":
                fired_conditions.append({
                    "pod": node.node,
                    "namespace": "kube-system",
                    "rule": "node-down",
                    "severity": "critical",
                    "message": f"Node {node.node} status is {node.status}",
                })

        # 3. Query existing active alerts in MongoDB
        alerts_col = db["alerts"]
        cursor = alerts_col.find({"status": "active"})
        active_alerts = await cursor.to_list(length=1000)
        active_alert_map = {f"{a.get('pod')}::{a.get('rule')}": a for a in active_alerts}

        fired_keys: Set[str] = set()

        # 4. Insert new alerts
        for cond in fired_conditions:
            key = f"{cond['pod']}::{cond['rule']}"
            fired_keys.add(key)

            if key not in active_alert_map:
                try:
                    new_alert_doc = {
                        "pod": cond["pod"],
                        "namespace": cond["namespace"],
                        "rule": cond["rule"],
                        "severity": cond["severity"],
                        "message": cond["message"],
                        "status": "active",
                        "acknowledged": False,
                        "source": "rule",
                        "likely_root_cause": None,
                        "recommended_action": None,
                        "created_at": datetime.now(timezone.utc),
                        "resolved_at": None,
                    }
                    await alerts_col.insert_one(new_alert_doc)
                    # Trigger Slack alert
                    await send_slack_alert(
                        pod=cond["pod"],
                        namespace=cond["namespace"],
                        rule=cond["rule"],
                        severity=cond["severity"],
                        message=cond["message"],
                    )
                except Exception as err:
                    print(f"[RuleEngine] Error inserting alert {key}: {err}")

        # 5. Auto-resolve healed alerts
        for key, alert in active_alert_map.items():
            if key not in fired_keys:
                try:
                    await alerts_col.update_one(
                        {"_id": alert["_id"]},
                        {
                            "$set": {
                                "status": "resolved",
                                "resolved_at": datetime.now(timezone.utc),
                            }
                        },
                    )
                except Exception as err:
                    print(f"[RuleEngine] Error auto-resolving alert {key}: {err}")

    except Exception as err:
        print(f"[RuleEngine] Error in evaluation cycle: {err}")


async def rule_engine_loop():
    interval_sec = max(5, int(settings.RULE_ENGINE_INTERVAL_MS / 1000))
    print(f"[RuleEngine] Starting background evaluation loop every {interval_sec}s")
    await asyncio.sleep(2)  # Initial grace period

    while is_engine_running:
        await run_rule_evaluation()
        await asyncio.sleep(interval_sec)


def start_rule_engine():
    global is_engine_running, rule_engine_task
    if is_engine_running:
        return
    is_engine_running = True
    rule_engine_task = asyncio.create_task(rule_engine_loop())


def stop_rule_engine():
    global is_engine_running, rule_engine_task
    is_engine_running = False
    if rule_engine_task:
        rule_engine_task.cancel()
        rule_engine_task = None

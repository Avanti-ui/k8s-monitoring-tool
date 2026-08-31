import asyncio
from datetime import datetime, timezone
from typing import List
from app.config import settings
from app.core.database import get_database
from app.services.prometheus import fetch_pod_metrics_summary
from app.services.loki import fetch_pod_logs
from app.services.ai import (
    get_ai_provider,
    AnalysisInput,
    PodMetricSummary,
    PodErrorLogSample,
    Finding,
)
from app.services.slack import send_slack_ai_finding

is_ai_running = False
ai_engine_task: asyncio.Task | None = None


async def run_ai_evaluation():
    if not settings.AI_ENABLED:
        return

    try:
        provider = get_ai_provider()
        if not provider:
            return

        # 1. Fetch current pod metrics from Prometheus
        pods = await fetch_pod_metrics_summary()
        if not pods:
            return

        pod_summaries: List[PodMetricSummary] = []
        error_samples: List[PodErrorLogSample] = []

        for p in pods:
            # Filter out noisy internal Kubernetes system namespaces if enabled
            if settings.EXCLUDE_SYSTEM_NAMESPACES and p.namespace in settings.IGNORED_NAMESPACES:
                continue

            pod_summaries.append(
                PodMetricSummary(
                    pod=p.pod,
                    namespace=p.namespace,
                    cpu_percent_avg=round(p.cpu_percent, 2),
                    cpu_percent_max=round(p.cpu_percent, 2),
                    memory_percent_avg=round(p.memory_percent, 2),
                    memory_percent_max=round(p.memory_percent, 2),
                    restart_count=p.restart_count,
                )
            )

            # Sample error logs for user pods
            try:
                logs = await fetch_pod_logs(p.pod, limit=25)
                error_lines = [
                    l.line for l in logs
                    if any(k in l.line.lower() for k in ["error", "exception", "fatal", "warn", "panic", "timeout", "oom", "deadlock", "refused", "504", "500"])
                ]
                if error_lines:
                    # Cap to 3 lines to strictly bound LLM token usage and cost
                    error_samples.append(
                        PodErrorLogSample(
                            pod=p.pod,
                            count=len(error_lines),
                            sample_lines=error_lines[:3],
                        )
                    )
            except Exception as log_err:
                print(f"[AiEngine] Error sampling logs for {p.pod}: {log_err}")



        # 2. Build analysis input
        payload = AnalysisInput(
            window_minutes=15,
            pods=pod_summaries,
            recent_error_logs=error_samples,
        )

        print(f"[AiEngine] Triggering {settings.AI_PROVIDER} analysis cycle for {len(pod_summaries)} pods...")
        result = await provider.analyze(payload)

        if not result.anomalies_detected or not result.findings:
            print("[AiEngine] AI analysis complete: No anomalies detected.")
            return

        # 3. Store findings & dispatch Slack notifications
        db = get_database()
        alerts_col = db["alerts"]

        # Find existing active AI alerts to prevent duplicate notifications
        cursor = alerts_col.find({"status": "active", "source": "ai"})
        active_ai_alerts = await cursor.to_list(length=500)
        active_ai_keys = {f"{a.get('pod')}::{a.get('message')}" for a in active_ai_alerts}

        for finding in result.findings:
            finding_key = f"{finding.pod}::{finding.summary}"
            if finding_key in active_ai_keys:
                continue

            # Insert alert doc into MongoDB
            new_alert_doc = {
                "pod": finding.pod,
                "namespace": finding.namespace or "default",
                "rule": f"ai-anomaly-{finding.severity}",
                "severity": finding.severity,
                "message": finding.summary,
                "status": "active",
                "acknowledged": False,
                "source": "ai",
                "likely_root_cause": finding.likely_root_cause,
                "recommended_action": finding.recommended_action,
                "created_at": datetime.now(timezone.utc),
                "resolved_at": None,
            }

            try:
                await alerts_col.insert_one(new_alert_doc)
                print(f"[AiEngine] Saved new AI finding for pod {finding.pod}: {finding.summary}")
            except Exception as err:
                print(f"[AiEngine] Error saving AI finding: {err}")

            # Send Slack notification with small throttle to respect Slack rate limits
            try:
                await send_slack_ai_finding(finding, namespace=finding.namespace or "default")
                await asyncio.sleep(0.6)  # 600ms throttle between webhook calls
            except Exception as slack_err:
                print(f"[AiEngine] Error sending AI Slack notification: {slack_err}")


    except Exception as err:
        print(f"[AiEngine] Error in AI evaluation cycle: {err}")


async def ai_engine_loop():
    interval_sec = max(30, int(settings.AI_ANALYSIS_INTERVAL_MS / 1000))
    print(f"[AiEngine] Starting background AI anomaly detection loop every {interval_sec}s (Provider: {settings.AI_PROVIDER})")
    await asyncio.sleep(5)  # Grace period at boot

    while is_ai_running:
        await run_ai_evaluation()
        await asyncio.sleep(interval_sec)


def start_ai_engine():
    global is_ai_running, ai_engine_task
    if not settings.AI_ENABLED:
        print("[AiEngine] AI analysis is disabled (AI_ENABLED=false).")
        return
    if is_ai_running:
        return
    is_ai_running = True
    ai_engine_task = asyncio.create_task(ai_engine_loop())


def stop_ai_engine():
    global is_ai_running, ai_engine_task
    is_ai_running = False
    if ai_engine_task:
        ai_engine_task.cancel()
        ai_engine_task = None

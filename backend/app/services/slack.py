import httpx
from datetime import datetime, timezone
from app.config import settings
from app.services.ai.base import Finding


async def send_slack_alert(pod: str, namespace: str, rule: str, severity: str, message: str):
    """Sends immediate rule-based alert to SLACK_WEBHOOK_URL_ALERTS."""
    webhook_url = settings.SLACK_WEBHOOK_URL_ALERTS
    if not webhook_url:
        return

    emoji = "🚨" if severity == "critical" else "⚠️"
    current_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    payload = {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} [{severity.upper()}] Alert: {rule}",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Pod:*\n`{pod}`"},
                    {"type": "mrkdwn", "text": f"*Namespace:*\n`{namespace}`"},
                    {"type": "mrkdwn", "text": f"*Severity:*\n`{severity.upper()}`"},
                    {"type": "mrkdwn", "text": f"*Time:*\n{current_time}"},
                ],
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Details:* {message}"},
            },
            {"type": "divider"},
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code != 200:
                print(f"[Slack] Error sending alert webhook: {resp.status_code} - {resp.text}")
    except Exception as err:
        print(f"[Slack] Exception during alert webhook call: {err}")


async def send_slack_ai_finding(finding: Finding, namespace: str = "default"):
    """Sends AI diagnostic insight to SLACK_WEBHOOK_URL_AI_ANALYSIS."""
    webhook_url = settings.SLACK_WEBHOOK_URL_AI_ANALYSIS
    if not webhook_url:
        return

    emoji = "🔴" if finding.severity == "critical" else ("🟡" if finding.severity == "warning" else "🔵")
    current_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    payload = {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🔎 AI Incident Insights — {finding.pod}",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Pod:*\n`{finding.pod}`"},
                    {"type": "mrkdwn", "text": f"*Namespace:*\n`{finding.namespace or namespace}`"},
                    {"type": "mrkdwn", "text": f"*Severity:*\n{emoji} `{finding.severity.upper()}`"},
                    {"type": "mrkdwn", "text": f"*Analyzed At:*\n{current_time}"},
                ],
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*📋 Summary:*\n{finding.summary}",
                },
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*🎯 Likely Root Cause:*\n{finding.likely_root_cause}",
                },
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*💡 Recommended Action:*\n```{finding.recommended_action}```",
                },
            },
            {"type": "divider"},
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code != 200:
                print(f"[Slack] Error sending AI analysis webhook: {resp.status_code} - {resp.text}")
    except Exception as err:
        print(f"[Slack] Exception during AI analysis webhook call: {repr(err)}")


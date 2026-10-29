"""
SMTP Email alerting and incident notification service.
Formats and dispatches structured HTML and plain-text emails for Kubernetes threshold violations
and AI diagnostic root-cause reports.
"""

import asyncio
import smtplib
import ssl
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional, Tuple

from app.config import settings
from app.services.ai.base import Finding


async def get_alert_recipients() -> List[str]:
    """
    Retrieves all destination email addresses for alert dispatches:
    1. Static emails configured in settings.SMTP_TO_EMAILS
    2. All registered users who have signed up or logged in (queried from MongoDB 'users' collection)
    Returns a deduplicated, sorted list of valid lowercase email addresses.
    """
    recipients = set()

    # 1. Static emails from settings
    static_emails = settings.SMTP_TO_EMAILS
    if isinstance(static_emails, str):
        static_emails = [static_emails]
    for email in (static_emails or []):
        if email and isinstance(email, str) and email.strip():
            recipients.add(email.strip().lower())

    # 2. Registered users from database
    try:
        from app.core.database import get_database
        db = get_database()
        cursor = db["users"].find({}, {"email": 1})
        async for user_doc in cursor:
            email = user_doc.get("email")
            if email and isinstance(email, str) and email.strip():
                recipients.add(email.strip().lower())
    except Exception as exc:
        print(f"[Email] Warning: Failed to query registered users for alerts: {exc}")

    return sorted(list(recipients))


def _send_smtp_sync(
    subject: str,
    text_content: str,
    html_content: str,
    to_addrs: Optional[List[str]] = None,
) -> Tuple[bool, str]:
    """
    Synchronous SMTP delivery helper executed in a worker thread.
    Dispatches individual emails to each recipient to preserve recipient privacy.
    Returns (success, message).
    """
    if not settings.SMTP_ENABLED:
        return False, "SMTP alerting is disabled (SMTP_ENABLED=False)"

    if not settings.SMTP_HOST or not settings.SMTP_HOST.strip():
        return False, "SMTP_HOST is not configured"

    recipients = to_addrs or settings.SMTP_TO_EMAILS
    if not recipients:
        return False, "No recipient email addresses specified"

    sender = settings.SMTP_FROM_EMAIL or settings.SMTP_USER or "k8s-monitor@localhost"

    sent_count = 0
    errors = []

    def _deliver_messages(server):
        nonlocal sent_count
        for rcpt in recipients:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = sender
                msg["To"] = rcpt
                msg["Date"] = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

                msg.attach(MIMEText(text_content, "plain", "utf-8"))
                msg.attach(MIMEText(html_content, "html", "utf-8"))

                server.sendmail(sender, [rcpt], msg.as_string())
                sent_count += 1
            except Exception as rcpt_err:
                errors.append(f"{rcpt}: {rcpt_err}")
                print(f"[Email] Failed delivery to {rcpt}: {rcpt_err}")

    try:
        if settings.SMTP_USE_SSL:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15.0, context=context) as server:
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                _deliver_messages(server)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15.0) as server:
                if settings.SMTP_USE_TLS:
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                _deliver_messages(server)

        if sent_count > 0:
            print(f"[Email] Alert successfully sent to {sent_count}/{len(recipients)} recipient(s): {subject}")
            return True, f"Email sent successfully to {sent_count} recipient(s)"
        else:
            err_summary = "; ".join(errors) if errors else "No emails could be delivered"
            return False, f"Failed to send email: {err_summary}"
    except Exception as exc:
        err_msg = f"[Email] Exception during SMTP dispatch: {exc}"
        print(err_msg)
        return False, str(exc)


async def send_email_alert(
    pod: str,
    namespace: str,
    rule: str,
    severity: str,
    message: str,
    to_addrs: Optional[List[str]] = None,
) -> Tuple[bool, str]:
    """
    Sends immediate rule-based alert (CPU, memory, crashloop, node-down) via SMTP email.
    """
    if not settings.SMTP_ENABLED or not settings.SMTP_HOST or not settings.SMTP_HOST.strip():
        return False, "Email alerting not enabled or configured"

    recipients = to_addrs if to_addrs is not None else await get_alert_recipients()
    if not recipients:
        return False, "No recipient email addresses configured or registered"

    sev_upper = severity.upper()
    emoji = "🚨" if severity == "critical" else "⚠️"
    current_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    subject = f"{emoji} [{sev_upper}] K8s Alert: {rule} on {pod} ({namespace})"

    # Plain text alternative
    text_content = f"""====================================================
KUBERNETES INCIDENT ALERT: {rule}
====================================================
Severity:  {sev_upper}
Pod:       {pod}
Namespace: {namespace}
Triggered: {current_time}

Details:
{message}

----------------------------------------------------
Sent automatically by K8s Autonomous Monitoring & Alert Engine
"""

    # Modern HTML email
    badge_color = "#ef4444" if severity == "critical" else "#f59e0b"
    badge_bg = "#fee2e2" if severity == "critical" else "#fef3c7"

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
    .container {{ max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
    .header {{ background-color: #0f172a; padding: 20px 24px; color: #ffffff; border-bottom: 3px solid {badge_color}; }}
    .header h2 {{ margin: 0; font-size: 18px; font-weight: 600; }}
    .badge {{ display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; background-color: {badge_bg}; color: {badge_color}; margin-top: 8px; }}
    .body {{ padding: 24px; }}
    .meta-table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
    .meta-table td {{ padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }}
    .meta-table td.label {{ width: 28%; font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 11px; }}
    .meta-table td.value {{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #0f172a; }}
    .details-box {{ background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid {badge_color}; padding: 14px 18px; border-radius: 6px; font-size: 14px; line-height: 1.5; color: #334155; }}
    .footer {{ background-color: #f1f5f9; padding: 14px 24px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>{emoji} Kubernetes Incident Alert: {rule}</h2>
      <span class="badge">{sev_upper}</span>
    </div>
    <div class="body">
      <table class="meta-table">
        <tr>
          <td class="label">Pod</td>
          <td class="value"><code>{pod}</code></td>
        </tr>
        <tr>
          <td class="label">Namespace</td>
          <td class="value"><code>{namespace}</code></td>
        </tr>
        <tr>
          <td class="label">Rule Breached</td>
          <td class="value">{rule}</td>
        </tr>
        <tr>
          <td class="label">Alert Time</td>
          <td class="value">{current_time}</td>
        </tr>
      </table>

      <div class="details-box">
        <strong>Incident Details:</strong><br/>
        {message}
      </div>
    </div>
    <div class="footer">
      Sent by K8s Autonomous Monitoring &amp; Alert Engine &bull; Observability Stack
    </div>
  </div>
</body>
</html>
"""

    return await asyncio.to_thread(
        _send_smtp_sync,
        subject=subject,
        text_content=text_content,
        html_content=html_content,
        to_addrs=recipients,
    )


async def send_email_ai_finding(
    finding: Finding,
    namespace: str = "default",
    to_addrs: Optional[List[str]] = None,
) -> Tuple[bool, str]:
    """
    Sends AI diagnostic insight and root-cause analysis via SMTP email.
    """
    if not settings.SMTP_ENABLED or not settings.SMTP_HOST or not settings.SMTP_HOST.strip():
        return False, "Email alerting not enabled or configured"

    recipients = to_addrs if to_addrs is not None else await get_alert_recipients()
    if not recipients:
        return False, "No recipient email addresses configured or registered"

    sev_upper = finding.severity.upper()
    current_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    ns = finding.namespace or namespace

    subject = f"🔎 [AI ROOT-CAUSE - {sev_upper}] Diagnostic Insight: {finding.pod} ({ns})"

    # Plain text
    text_content = f"""====================================================
🔎 KUBERNETES AI DIAGNOSTIC REPORT
====================================================
Pod:         {finding.pod}
Namespace:   {ns}
Severity:    {sev_upper}
Analyzed At: {current_time}

📋 INCIDENT SUMMARY:
{finding.summary}

🎯 LIKELY ROOT CAUSE:
{finding.likely_root_cause}

💡 RECOMMENDED REMEDIATION:
{finding.recommended_action}

----------------------------------------------------
Sent automatically by K8s Autonomous AI Observability Engine
"""

    badge_color = "#dc2626" if finding.severity == "critical" else ("#d97706" if finding.severity == "warning" else "#2563eb")
    badge_bg = "#fee2e2" if finding.severity == "critical" else ("#fef3c7" if finding.severity == "warning" else "#dbeafe")

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
    .container {{ max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
    .header {{ background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 20px 24px; color: #ffffff; border-bottom: 3px solid #6366f1; }}
    .header h2 {{ margin: 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; }}
    .badge {{ display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; background-color: {badge_bg}; color: {badge_color}; margin-top: 8px; }}
    .body {{ padding: 24px; }}
    .meta-table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
    .meta-table td {{ padding: 7px 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }}
    .meta-table td.label {{ width: 28%; font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 11px; }}
    .meta-table td.value {{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #0f172a; }}
    .section-card {{ background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; margin-bottom: 16px; }}
    .section-title {{ font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }}
    .section-text {{ font-size: 14px; line-height: 1.5; color: #1e293b; margin: 0; }}
    .code-block {{ background-color: #0f172a; color: #38bdf8; padding: 12px 14px; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; overflow-x: auto; margin-top: 6px; }}
    .footer {{ background-color: #f1f5f9; padding: 14px 24px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🤖 Kubernetes AI Incident Insights</h2>
      <span class="badge">{sev_upper}</span>
    </div>
    <div class="body">
      <table class="meta-table">
        <tr>
          <td class="label">Pod</td>
          <td class="value"><code>{finding.pod}</code></td>
        </tr>
        <tr>
          <td class="label">Namespace</td>
          <td class="value"><code>{ns}</code></td>
        </tr>
        <tr>
          <td class="label">Analyzed At</td>
          <td class="value">{current_time}</td>
        </tr>
      </table>

      <div class="section-card">
        <div class="section-title">📋 Summary</div>
        <p class="section-text">{finding.summary}</p>
      </div>

      <div class="section-card">
        <div class="section-title">🎯 Likely Root Cause</div>
        <p class="section-text">{finding.likely_root_cause}</p>
      </div>

      <div class="section-card" style="border-left: 4px solid #10b981;">
        <div class="section-title" style="color: #059669;">💡 Recommended Remediation</div>
        <div class="code-block">{finding.recommended_action}</div>
      </div>
    </div>
    <div class="footer">
      Sent by K8s Autonomous AI Observability Engine &bull; Observability Stack
    </div>
  </div>
</body>
</html>
"""

    return await asyncio.to_thread(
        _send_smtp_sync,
        subject=subject,
        text_content=text_content,
        html_content=html_content,
        to_addrs=recipients,
    )


async def send_test_email(to_email: Optional[str] = None) -> Tuple[bool, str]:
    """
    Sends a test verification email to confirm SMTP connectivity and credentials.
    """
    if to_email and to_email.strip():
        recipients = [to_email.strip().lower()]
    else:
        recipients = await get_alert_recipients()

    if not recipients:
        return False, "No recipient email provided, no users registered, and SMTP_TO_EMAILS is empty"

    current_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    subject = "✅ K8s Monitoring Tool - SMTP Alert Configuration Test"

    text_content = f"""K8s Monitoring Tool - SMTP Alert Test
Time: {current_time}

Your SMTP configuration is working properly!
Alerts and AI incident insights will be delivered to this email address.
"""

    html_content = f"""<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <h2 style="color: #10b981; margin-top: 0;">✅ SMTP Alert Integration Verified</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #334155;">
      Your SMTP notification service is connected and operating successfully.
    </p>
    <div style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 6px; font-size: 13px; font-family: monospace;">
      Host: {settings.SMTP_HOST}:{settings.SMTP_PORT}<br/>
      TLS Enabled: {settings.SMTP_USE_TLS}<br/>
      Verified At: {current_time}
    </div>
    <p style="font-size: 13px; color: #64748b; margin-top: 20px;">
      You will now receive high-priority Kubernetes threshold alerts and AI incident root-cause reports directly in this inbox.
    </p>
  </div>
</body>
</html>
"""

    return await asyncio.to_thread(
        _send_smtp_sync,
        subject=subject,
        text_content=text_content,
        html_content=html_content,
        to_addrs=recipients,
    )

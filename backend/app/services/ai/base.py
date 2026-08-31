import re
import json
from abc import ABC, abstractmethod
from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class PodMetricSummary(BaseModel):
    pod: str
    namespace: str
    cpu_percent_avg: float
    cpu_percent_max: float
    memory_percent_avg: float
    memory_percent_max: float
    restart_count: int


class PodErrorLogSample(BaseModel):
    pod: str
    count: int
    sample_lines: List[str] = Field(default_factory=list)


class AnalysisInput(BaseModel):
    window_minutes: int = 15
    pods: List[PodMetricSummary]
    recent_error_logs: List[PodErrorLogSample] = Field(default_factory=list)


class Finding(BaseModel):
    pod: str
    namespace: Optional[str] = "default"
    severity: Literal["info", "warning", "critical"]
    summary: str  # one sentence, plain English
    likely_root_cause: str  # one sentence
    recommended_action: str  # one sentence


class AnalysisResult(BaseModel):
    anomalies_detected: bool
    findings: List[Finding] = Field(default_factory=list)


AI_SYSTEM_PROMPT = """You are a Principal Site Reliability Engineer (SRE) and Kubernetes Observability Expert.
Given aggregated pod metrics (CPU, Memory, Restarts) and sampled application error logs, conduct an in-depth anomaly triage.

Analyze for:
1. Application errors (HTTP 500/504, DB pool exhaustion, concurrency deadlocks, unhandled exceptions, Redis/DB connection drops).
2. Resource trend anomalies (slow memory leaks, CPU thrashing, GC pauses, OOM risks).
3. Pod instability (CrashLoopBackOff, frequent restarts, liveness/readiness probe failures).

Guidelines for your response:
- summary: Clear, high-impact synopsis of the incident (mention specific error types, affected routes, or telemetry trends).
- likely_root_cause: In-depth technical root cause explaining WHY it happened (e.g. unclosed DB connection, deadlock on mutex/lock, heap allocation leak, downstream network timeout).
- recommended_action: Practical, step-by-step remediation guide including exact executable kubectl commands or code/configuration fixes (e.g. "1. Quick mitigation: `kubectl rollout restart deployment/<app>` | 2. Fix: Check DB pool release in checkout handler and configure circuit breaker timeout").

Respond with ONLY valid JSON matching this exact schema, with NO markdown formatting, NO backticks, and NO conversational prose:
{
  "anomalies_detected": boolean,
  "findings": [
    {
      "pod": "string",
      "namespace": "string",
      "severity": "info" | "warning" | "critical",
      "summary": "Specific and clear incident summary",
      "likely_root_cause": "Detailed technical root cause analysis",
      "recommended_action": "Actionable step-by-step fix with exact commands"
    }
  ]
}
"""



def clean_json_response(raw_text: str) -> dict:
    """Safely extracts and parses JSON even if LLM wraps it in markdown backticks."""
    text = raw_text.strip()
    # Strip markdown fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
    text = text.strip()
    return json.loads(text)


class BaseAiProvider(ABC):
    @abstractmethod
    async def analyze(self, payload: AnalysisInput) -> AnalysisResult:
        """Analyze Kubernetes telemetry and return structured findings."""
        pass

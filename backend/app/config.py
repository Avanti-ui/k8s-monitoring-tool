"""
Global application configuration module powered by Pydantic BaseSettings.
Loads environment variables from .env files for server, database, Prometheus, Loki, Slack, and AI providers.
Provides strongly-typed settings used across the entire backend application.
"""

from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 4000
    DEBUG: bool = False

    # Security & Auth (Required for JWT token issuance)
    JWT_SECRET: str = Field(
        default="super-secret-k8s-monitor-jwt-key-2026",
        description="HMAC SHA-256 secret key for operator JWT tokens",
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    # Database (Async MongoDB via Motor)
    MONGO_URI: str = "mongodb://localhost:27017/k8s-monitor"

    # Upstream Observability Endpoints
    PROMETHEUS_URL: str = "http://localhost:9090"
    LOKI_URL: str = "http://localhost:3100"

    # Kubernetes Configuration
    KUBECONFIG: str | None = None
    K8S_API_SERVER: str | None = None

    # Alert Rule Engine
    RULE_ENGINE_INTERVAL_MS: int = 30000

    # Slack Integration Endpoints
    SLACK_WEBHOOK_URL_ALERTS: str | None = None
    SLACK_WEBHOOK_URL_AI_ANALYSIS: str | None = None

    # Email Integration Settings (SMTP)
    SMTP_ENABLED: bool = True
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_TO_EMAILS: Union[List[str], str] = []
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    # AI Anomaly Detection Settings
    AI_ENABLED: bool = True
    AI_PROVIDER: str = "groq"  # "groq" | "openai" | "anthropic" | "azure"
    AI_MODEL: str = "openai/gpt-oss-120b"
    AI_ANALYSIS_INTERVAL_MS: int = 30000  # 30 seconds

    # Namespace Filtering (Filter out noisy internal Kubernetes system pods)
    EXCLUDE_SYSTEM_NAMESPACES: bool = True
    IGNORED_NAMESPACES: List[str] = [
        "kube-system",
        "kube-public",
        "kube-node-lease",
        "monitoring",
    ]

    # AI Provider API Keys & Endpoints
    GROQ_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    AZURE_OPENAI_API_KEY: str | None = None
    AZURE_OPENAI_ENDPOINT: str | None = None

    # CORS configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

    @field_validator("SMTP_TO_EMAILS", mode="after")
    @classmethod
    def assemble_smtp_to_emails(cls, v: Union[str, List[str], None]) -> List[str]:
        if not v:
            return []
        if isinstance(v, str):
            v_clean = v.strip()
            if v_clean.startswith("[") and v_clean.endswith("]"):
                import json
                try:
                    parsed = json.loads(v_clean)
                    if isinstance(parsed, list):
                        return [str(i).strip() for i in parsed if str(i).strip()]
                except Exception:
                    pass
            import re
            return [i.strip() for i in re.split(r"[,;]+", v_clean) if i.strip()]
        elif isinstance(v, list):
            return [str(i).strip() for i in v if str(i).strip()]
        return []

    @property
    def is_email_configured(self) -> bool:
        return bool(self.SMTP_ENABLED and self.SMTP_HOST and self.SMTP_HOST.strip())


settings = Settings()


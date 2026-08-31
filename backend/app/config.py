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


settings = Settings()


from app.config import settings
from app.services.ai.base import (
    BaseAiProvider,
    AnalysisInput,
    AnalysisResult,
    Finding,
    PodMetricSummary,
    PodErrorLogSample,
)
from app.services.ai.groq_provider import GroqProvider
from app.services.ai.openai_provider import OpenAiProvider
from app.services.ai.anthropic_provider import AnthropicProvider
from app.services.ai.azure_provider import AzureOpenAiProvider


def get_ai_provider() -> BaseAiProvider | None:
    if not settings.AI_ENABLED:
        return None

    provider_name = (settings.AI_PROVIDER or "").lower().strip()

    if provider_name == "groq":
        if not settings.GROQ_API_KEY:
            raise RuntimeError("AI_ENABLED is true with AI_PROVIDER=groq, but GROQ_API_KEY is not set.")
        model = settings.AI_MODEL or "openai/gpt-oss-120b"
        return GroqProvider(api_key=settings.GROQ_API_KEY, model=model)




    elif provider_name == "openai":
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("AI_ENABLED is true with AI_PROVIDER=openai, but OPENAI_API_KEY is not set.")
        model = settings.AI_MODEL or "gpt-4o-mini"
        return OpenAiProvider(api_key=settings.OPENAI_API_KEY, model=model)

    elif provider_name == "anthropic":
        if not settings.ANTHROPIC_API_KEY:
            raise RuntimeError("AI_ENABLED is true with AI_PROVIDER=anthropic, but ANTHROPIC_API_KEY is not set.")
        model = settings.AI_MODEL or "claude-3-5-sonnet-20241022"
        return AnthropicProvider(api_key=settings.ANTHROPIC_API_KEY, model=model)

    elif provider_name == "azure":
        if not settings.AZURE_OPENAI_API_KEY or not settings.AZURE_OPENAI_ENDPOINT:
            raise RuntimeError("AI_ENABLED is true with AI_PROVIDER=azure, but AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT is not set.")
        model = settings.AI_MODEL or "gpt-4o"
        return AzureOpenAiProvider(
            api_key=settings.AZURE_OPENAI_API_KEY,
            endpoint=settings.AZURE_OPENAI_ENDPOINT,
            deployment_name=model,
        )

    else:
        raise RuntimeError(f"Unsupported AI_PROVIDER '{provider_name}'. Must be one of 'groq', 'openai', 'anthropic', 'azure'.")

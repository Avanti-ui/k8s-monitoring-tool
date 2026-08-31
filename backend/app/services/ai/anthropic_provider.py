import httpx
from app.services.ai.base import (
    BaseAiProvider,
    AnalysisInput,
    AnalysisResult,
    AI_SYSTEM_PROMPT,
    clean_json_response,
)


class AnthropicProvider(BaseAiProvider):
    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20241022"):
        self.api_key = api_key
        self.model = model
        self.endpoint = "https://api.anthropic.com/v1/messages"

    async def analyze(self, payload: AnalysisInput) -> AnalysisResult:
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        user_content = payload.model_dump_json()

        body = {
            "model": self.model,
            "max_tokens": 2048,
            "system": AI_SYSTEM_PROMPT,
            "messages": [
                {
                    "role": "user",
                    "content": f"Telemetry Input:\n{user_content}",
                }
            ],
            "temperature": 0.1,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.endpoint, headers=headers, json=body)
            if resp.status_code != 200:
                print(f"[AnthropicProvider] API Error {resp.status_code}: {resp.text}")
                return AnalysisResult(anomalies_detected=False, findings=[])

            data = resp.json()
            raw_content = ""
            for block in data.get("content", []):
                if block.get("type") == "text":
                    raw_content += block.get("text", "")

            parsed = clean_json_response(raw_content)
            return AnalysisResult.model_validate(parsed)

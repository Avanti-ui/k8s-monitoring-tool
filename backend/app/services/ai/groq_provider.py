import httpx
from app.config import settings
from app.services.ai.base import (
    BaseAiProvider,
    AnalysisInput,
    AnalysisResult,
    AI_SYSTEM_PROMPT,
    clean_json_response,
)


class GroqProvider(BaseAiProvider):
    def __init__(self, api_key: str, model: str = "llama-3.1-8b-instant"):
        self.api_key = api_key

        self.model = model
        self.endpoint = "https://api.groq.com/openai/v1/chat/completions"

    async def analyze(self, payload: AnalysisInput) -> AnalysisResult:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        user_content = payload.model_dump_json()

        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": AI_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Telemetry Input:\n{user_content}",
                },
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.endpoint, headers=headers, json=body)
            if resp.status_code != 200:
                print(f"[GroqProvider] API Error {resp.status_code}: {resp.text}")
                return AnalysisResult(anomalies_detected=False, findings=[])

            data = resp.json()
            raw_content = data["choices"][0]["message"]["content"]
            parsed = clean_json_response(raw_content)
            return AnalysisResult.model_validate(parsed)

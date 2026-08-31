import httpx
from app.services.ai.base import (
    BaseAiProvider,
    AnalysisInput,
    AnalysisResult,
    AI_SYSTEM_PROMPT,
    clean_json_response,
)


class AzureOpenAiProvider(BaseAiProvider):
    def __init__(self, api_key: str, endpoint: str, deployment_name: str = "gpt-4o"):
        self.api_key = api_key
        self.endpoint = endpoint.rstrip("/")
        self.deployment = deployment_name

    async def analyze(self, payload: AnalysisInput) -> AnalysisResult:
        url = f"{self.endpoint}/openai/deployments/{self.deployment}/chat/completions?api-version=2024-02-15-preview"
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }

        user_content = payload.model_dump_json()

        body = {
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
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code != 200:
                print(f"[AzureOpenAiProvider] API Error {resp.status_code}: {resp.text}")
                return AnalysisResult(anomalies_detected=False, findings=[])

            data = resp.json()
            raw_content = data["choices"][0]["message"]["content"]
            parsed = clean_json_response(raw_content)
            return AnalysisResult.model_validate(parsed)

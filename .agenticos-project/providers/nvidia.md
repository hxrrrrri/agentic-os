# Provider: NVIDIA

NVIDIA NIM (NVIDIA Inference Microservices) provides access to a large catalog of optimized open and proprietary models via an OpenAI-compatible API. It is the correct choice when a user needs a cloud-hosted model with strong performance, does not have an Anthropic or OpenAI account, or wants to use NVIDIA-optimized variants of open-weight models.

---

## Endpoint Configuration

| Setting | Value |
|---|---|
| Base URL | `https://integrate.api.nvidia.com/v1` |
| Chat completions | `POST /chat/completions` |
| Model discovery | `GET /models` |
| Auth header | `Authorization: Bearer $NVIDIA_API_KEY` |
| Timeout | 60 seconds |
| Required env var | `NVIDIA_API_KEY` |

---

## Authentication

```typescript
// Required in process.env
NVIDIA_API_KEY="nvapi-..."
```

- The key must be set as an environment variable before the session starts.
- Never include the key in run output, vault artifacts, audit logs, or error messages. Reference it by variable name only: `NVIDIA_API_KEY`.
- If the key is missing at pre-run time: mark the provider as unavailable, set execution mode to `mock`, and surface: `"NVIDIA_API_KEY is not configured. Add it to your .env file to enable NVIDIA generation."`

---

## Model Discovery

```
GET https://integrate.api.nvidia.com/v1/models
Authorization: Bearer $NVIDIA_API_KEY
```

Response shape (OpenAI-compatible):
```json
{
  "data": [
    { "id": "meta/llama-3.1-70b-instruct" },
    { "id": "nvidia/llama-3.1-nemotron-70b-instruct" },
    { "id": "mistralai/mixtral-8x22b-instruct-v0.1" }
  ]
}
```

- Deduplicate model IDs — the catalog may contain duplicates across versions.
- Use `model.id` as the model ID for chat completions.
- Cache the model list for the session — do not re-fetch on every run.

### Recommended Models by Task Type

| Task Type | Model ID | Notes |
|---|---|---|
| General workflow | `meta/llama-3.1-8b-instruct` | Fast, good quality, low cost |
| Complex reasoning | `meta/llama-3.1-70b-instruct` | Strong reasoning, higher latency |
| NVIDIA-optimized | `nvidia/llama-3.1-nemotron-70b-instruct` | Best quality in NVIDIA catalog |
| Code generation | `deepseek-ai/deepseek-coder-6.7b-instruct` | Strong structured output |
| Long context | `meta/llama-3.1-405b-instruct` | Maximum capability, highest cost |
| Fast / cheap | `meta/llama-3.2-3b-instruct` | Quick responses for simple tasks |

---

## Chat Completions Request

```typescript
POST https://integrate.api.nvidia.com/v1/chat/completions
Authorization: Bearer $NVIDIA_API_KEY
Content-Type: application/json

{
  "model": "meta/llama-3.1-70b-instruct",
  "temperature": 0.4,
  "max_tokens": 2048,
  "messages": [
    { "role": "system", "content": "[system prompt]" },
    { "role": "user", "content": "[user prompt]" }
  ]
}
```

Response shape (OpenAI-compatible):
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "[generated text]"
      }
    }
  ]
}
```

Extract content from: `body.choices?.[0]?.message?.content`

---

## Temperature and Parameter Guidance

| Task Type | Temperature | Max Tokens |
|---|---|---|
| Research synthesis, planning | 0.2–0.4 | 1500–2000 |
| Structured output (tables, JSON, code) | 0.1–0.3 | 1000–2000 |
| Content creation, scripts | 0.6–0.8 | 2000–4000 |
| Brainstorming, ideation | 0.7–0.9 | 1000–2000 |
| Classification, extraction | 0.0–0.2 | 200–500 |

---

## Error Handling

| Error | Cause | Response |
|---|---|---|
| `401 Unauthorized` | Invalid or missing API key | Surface: "NVIDIA_API_KEY is invalid or expired. Check the key and retry." Fall back to mock. |
| `404 Not Found` | Model ID does not exist in catalog | Surface: "Model `[id]` not found in NVIDIA catalog. Use model discovery to list available models." |
| `429 Too Many Requests` | Rate limit exceeded | Surface: "NVIDIA rate limit hit. Wait 60 seconds and retry, or switch to a different model." |
| `500 / 503` | NVIDIA API error | Surface the status code. Fall back to `summarize()`. Log error body. |
| Empty content | Model returned blank choices | Log as failure. Fall back to `summarize()`. Include failure note in output. |
| Timeout | Response exceeds 60 seconds | Surface timeout. Fall back to `summarize()`. Suggest a smaller/faster model. |

---

## Security Requirements

- `NVIDIA_API_KEY` must never appear in:
  - Run output or `finalOutput` text.
  - Vault artifacts or markdown files.
  - Audit log entries (log that the key was used, not its value).
  - Error messages displayed to the user.
  - Browser-accessible API responses.
- The key is accessed server-side only via `process.env.NVIDIA_API_KEY`.
- If a run output accidentally contains the key value, it must be treated as a secret exposure incident: rotate the key immediately, delete the artifact, and notify the user.

---

## Operational Notes

- NVIDIA NIM models vary significantly in quality. Test new models with a representative task before deploying them in production workflows.
- The NVIDIA catalog includes both NVIDIA-optimized models and standard open-weight models. NVIDIA-optimized variants (prefixed `nvidia/`) generally outperform equivalent standard versions.
- Cost varies by model size. For cost-sensitive workflows, prefer 8B–13B parameter models unless the task quality bar requires a larger model.
- NVIDIA does not guarantee persistent model availability. Models may be deprecated or moved. If a model returns 404 unexpectedly, re-run model discovery to refresh the catalog.

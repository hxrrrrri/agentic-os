# Provider: Ollama

Ollama is the primary local-first provider for AgenticOS. It runs open-weight models entirely on the user's machine — no cloud calls, no API keys, no data leaving the device. It is the correct default for privacy-sensitive tasks, offline workflows, and development environments.

---

## Endpoint Configuration

| Setting | Value |
|---|---|
| Base URL | `http://127.0.0.1:11434` |
| Chat completions | `POST /api/chat` |
| Model discovery | `GET /api/tags` |
| Health check | `GET /api/tags` (200 = running) |
| Timeout | 60 seconds (local models can be slow on large prompts) |

---

## Model Discovery

To list available local models:
```
GET http://127.0.0.1:11434/api/tags
```

Response shape:
```json
{
  "models": [
    {
      "name": "llama3:8b",
      "size": 4700000000,
      "modified_at": "2025-04-01T10:00:00Z"
    }
  ]
}
```

- Use `model.name` as the model ID for chat completions.
- Merge local models with known Ollama model IDs (for display in the model selector UI).
- A model name appearing in `/api/tags` is confirmed available. A model name not in the list must be pulled before use — it will return a 404 on the chat endpoint.

### Recommended Models by Task Type

| Task Type | Model | Notes |
|---|---|---|
| General workflow | `llama3.1:8b` | Fast, good instruction following |
| Complex reasoning | `llama3.1:70b` | Requires 40GB+ VRAM or unified memory |
| Code generation | `qwen2.5-coder:7b` | Strong on structured output |
| Long context | `gemma2:27b` | Good at maintaining coherence over long prompts |
| Fast / lightweight | `phi3.5:3.8b` | Good for terse tasks with limited hardware |

---

## Chat Completions Request

```typescript
POST http://127.0.0.1:11434/api/chat
Content-Type: application/json

{
  "model": "llama3.1:8b",
  "stream": false,
  "messages": [
    { "role": "system", "content": "[system prompt]" },
    { "role": "user", "content": "[user prompt]" }
  ]
}
```

Response shape:
```json
{
  "message": {
    "role": "assistant",
    "content": "[generated text]"
  }
}
```

Extract content from: `body.message?.content ?? body.response`

---

## Prompting Guidance for Local Models

Local models are generally less capable than frontier cloud models. Compensate with more explicit prompting:

**Structure compensation:**
- Use explicit numbered steps in the prompt. Local models benefit from scaffolding that cloud models do not need.
- State the expected output format in the prompt: "Respond in markdown with an H2 for each section."
- Avoid relying on the model to infer task type from context alone.

**Length management:**
- Local models tend to drift on very long outputs. Break complex tasks into focused sub-prompts where possible.
- Use `max_tokens` to prevent runaway generation on models that pad excessively.
- Target ≤ 1500 tokens for most local model responses. Use 2000–4000 only for long-form content tasks.

**Quality calibration:**
- Expect lower novelty and reasoning depth compared to cloud frontier models. This is normal.
- Local models are well-suited for: structured extraction, classification, summarization, template completion, and straightforward content generation.
- Local models are less suited for: complex multi-step reasoning, nuanced source comparison, and tasks requiring broad world knowledge.

---

## Error Handling

| Error | Cause | Response |
|---|---|---|
| `connection refused` | Ollama is not running | Surface: "Ollama is not running. Start it with `ollama serve` and retry." Set mode to `mock`. |
| `404 model not found` | Model not pulled locally | Surface: "Model `[name]` is not available. Pull it with `ollama pull [name]` and retry." |
| `Empty response` | Model returned blank output | Log as failure. Fall back to `summarize()`. Include failure note in output. |
| `Timeout (>60s)` | Model too slow for hardware | Surface timeout. Suggest using a smaller model. Fall back to `summarize()`. |
| Non-200 status | API error | Report exact HTTP status and response body in run output. Fall back to `summarize()`. |

---

## Privacy Properties

- All inference runs on the local machine. No prompt data is sent to external servers.
- No API key is required.
- Model weights are stored locally after the initial `ollama pull`.
- Vault artifacts are written to the local filesystem only.
- Ollama does not log prompts or responses to any external service.

This makes Ollama the correct choice for: confidential business data, personal notes, draft content not ready for external exposure, and any workflow where data residency matters.

---

## Operational Notes

- Ollama must be running (`ollama serve`) before the session-start hook checks provider availability.
- On macOS, Ollama runs as a menu bar app and starts automatically at login by default.
- On Linux/Windows, Ollama may need to be started manually or configured as a system service.
- GPU acceleration: Ollama uses Metal on macOS, CUDA on NVIDIA GPUs, and ROCm on AMD GPUs. CPU-only inference is supported but significantly slower for models >7B parameters.

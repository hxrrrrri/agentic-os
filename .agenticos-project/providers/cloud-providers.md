# Providers: Cloud Models

AgenticOS supports multiple cloud model providers through a unified adapter interface. All cloud providers share the same safety rules, approval gates, and local-first assumptions as local providers. Being cloud-hosted does not grant a provider additional permissions.

Current supported providers: **NVIDIA**, **OpenAI** (and compatible APIs), **Anthropic**, **Google Gemini**, **xAI Grok**, **OpenRouter**.

---

## Shared Requirements

All cloud provider adapters must satisfy every item in this list before being considered production-ready.

### Authentication
- Credentials must come exclusively from environment variables or a local secret manager.
- No API key may appear in run output, vault artifacts, audit logs, error messages, or browser-accessible API responses.
- Missing credentials: mark the provider as `unavailable`, set execution mode to `mock`, surface a clear message naming the missing variable.

### Interface Contract
Every adapter must implement the `generateWithModel` interface:
```typescript
async function generateWithModel(request: GenerateWithModelRequest): Promise<string>
```

Where `GenerateWithModelRequest` includes:
- `provider: ModelEndpoint` — the configured provider record.
- `model: string` — the model ID as returned by model discovery.
- `prompt: string` — the user prompt.
- `skill?: Skill` — the active skill, if any.
- `memoryCount: number` — number of indexed memory items.
- `projectContext?: string` — assembled project context from `.agenticos-project/`.

### Model Discovery
- Expose a model list via the provider's discovery endpoint.
- Deduplicate model IDs. Present them in a consistent format for the UI selector.
- Cache the model list for the session. Refresh only on explicit user action or session restart.
- If discovery fails: fall back to a hardcoded list of known-good model IDs for that provider.

### Error Handling
Every adapter must handle and surface:
- `401 / 403` — authentication failure. Surface the exact status and instruct the user to check their key.
- `404` — model not found. Surface the model ID and suggest model discovery.
- `429` — rate limit. Surface a wait instruction. Do not retry automatically without delay.
- `500 / 503` — provider error. Fall back to `summarize()`. Log the response body.
- Timeout — fall back to `summarize()`. Surface the timeout duration and suggest a smaller model.
- Empty response — fall back to `summarize()`. Log as a bug-level event.

### Timeout
Default: 60 seconds. Configurable per provider. Never wait indefinitely for a cloud response.

---

## Provider Reference

### OpenAI (and OpenAI-compatible APIs)

| Setting | Value |
|---|---|
| Base URL | `https://api.openai.com/v1` |
| Chat completions | `POST /chat/completions` |
| Model discovery | `GET /models` |
| Auth env var | `OPENAI_API_KEY` |
| Response path | `body.choices[0].message.content` |

**Recommended models:**

| Task | Model |
|---|---|
| General | `gpt-4o-mini` |
| Complex reasoning | `gpt-4o` |
| Long context | `gpt-4o` (128k context) |
| Fast / cheap | `gpt-4o-mini` |

**Notes:**
- OpenAI-compatible APIs (Groq, Together, Mistral, LM Studio with server mode) use the same adapter with a different base URL.
- For OpenAI-compatible providers, set both the base URL and the appropriate API key env var.

---

### Anthropic (Claude)

| Setting | Value |
|---|---|
| Base URL | `https://api.anthropic.com` |
| Chat completions | `POST /v1/messages` |
| Model discovery | Hardcoded list (no discovery endpoint) |
| Auth header | `x-api-key: $ANTHROPIC_API_KEY` |
| Version header | `anthropic-version: 2023-06-01` |
| Auth env var | `ANTHROPIC_API_KEY` |
| Response path | `body.content[0].text` |

**Request shape:**
```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 2048,
  "system": "[system prompt]",
  "messages": [
    { "role": "user", "content": "[user prompt]" }
  ]
}
```

**Recommended models:**

| Task | Model |
|---|---|
| General | `claude-sonnet-4-6` |
| Complex reasoning | `claude-opus-4-7` |
| Fast / cheap | `claude-haiku-4-5-20251001` |

**Notes:**
- Anthropic uses a non-OpenAI request and response shape. Do not use the OpenAI adapter for Anthropic.
- System prompt is a top-level field, not a message with `role: "system"`.
- Response content is in `body.content[0].text`, not `body.choices[0].message.content`.

---

### Google Gemini

| Setting | Value |
|---|---|
| Base URL | `https://generativelanguage.googleapis.com/v1beta` |
| Chat completions | `POST /models/{model}:generateContent` |
| Auth | `?key=$GOOGLE_API_KEY` query param |
| Auth env var | `GOOGLE_API_KEY` |
| Response path | `body.candidates[0].content.parts[0].text` |

**Recommended models:**

| Task | Model |
|---|---|
| General | `gemini-1.5-flash` |
| Complex reasoning | `gemini-1.5-pro` |
| Long context | `gemini-1.5-pro` (1M token context) |

**Notes:**
- Gemini uses a unique request shape. Do not use the OpenAI adapter.
- The model name is part of the URL path, not the request body.
- System instructions use the `systemInstruction` top-level field.

---

### xAI Grok

| Setting | Value |
|---|---|
| Base URL | `https://api.x.ai/v1` |
| Chat completions | `POST /chat/completions` (OpenAI-compatible) |
| Auth env var | `XAI_API_KEY` |
| Response path | `body.choices[0].message.content` |

**Recommended models:**

| Task | Model |
|---|---|
| General | `grok-beta` |

**Notes:**
- OpenAI-compatible. Use the OpenAI adapter with `baseUrl: "https://api.x.ai/v1"`.

---

### OpenRouter

| Setting | Value |
|---|---|
| Base URL | `https://openrouter.ai/api/v1` |
| Chat completions | `POST /chat/completions` (OpenAI-compatible) |
| Additional headers | `HTTP-Referer: [your site]`, `X-Title: AgenticOS` |
| Auth env var | `OPENROUTER_API_KEY` |
| Response path | `body.choices[0].message.content` |

**Notes:**
- OpenRouter proxies hundreds of models. Use the model ID format `provider/model-name` (e.g., `anthropic/claude-3.5-sonnet`).
- OpenAI-compatible. Use the OpenAI adapter with the OpenRouter base URL and additional headers.
- Useful as a fallback router when direct provider APIs are unavailable.

---

## Future Adapter Checklist

When adding a new provider, verify every item:

- [ ] Auth uses env var only. Key never logged or returned to client.
- [ ] Implements `generateWithModel` interface.
- [ ] Model discovery or hardcoded fallback list is available.
- [ ] All error codes (401, 404, 429, 500, timeout, empty) handled.
- [ ] System prompt correctly formatted for this provider's API shape.
- [ ] Provider ID registered in `lib/agent/providers.ts`.
- [ ] Tested with at least one real model call before merging.
- [ ] Graceful degradation to `summarize()` on any failure.
- [ ] No vendor-specific behavior bleeds into skill or agent playbooks.

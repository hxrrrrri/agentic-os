import { NextResponse } from "next/server";
import { agenticosConfig } from "@/agenticos.config";
import { listModelProviders } from "@/lib/agent/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = process.env;
  const credentials = {
    model: {
      nvidia: Boolean(env.NVIDIA_API_KEY),
      openai: Boolean(env.OPENAI_API_KEY),
      anthropic: Boolean(env.ANTHROPIC_API_KEY),
      gemini: Boolean(env.GEMINI_API_KEY),
      openrouter: Boolean(env.OPENROUTER_API_KEY),
      grok: Boolean(env.GROK_API_KEY) || Boolean(env.XAI_API_KEY),
    },
    integrations: {
      github: Boolean(env.GITHUB_TOKEN),
      firecrawl: Boolean(env.FIRECRAWL_API_KEY),
      youtube: Boolean(env.YOUTUBE_API_KEY),
      youtubeAnalytics: Boolean(env.YOUTUBE_ANALYTICS_TOKEN),
      stripe: Boolean(env.STRIPE_SECRET_KEY),
      shopify: Boolean(env.SHOPIFY_ADMIN_TOKEN),
      google: Boolean(env.GOOGLE_REFRESH_TOKEN),
      ntfy: Boolean(env.NTFY_TOPIC),
      slack: Boolean(env.SLACK_WEBHOOK_URL),
      discord: Boolean(env.DISCORD_WEBHOOK_URL),
    },
    security: {
      authToken: Boolean(env.AGENTICOS_AUTH_TOKEN),
      secretsKey: Boolean(env.AGENTICOS_SECRETS_KEY),
    },
    runtime: {
      mode: agenticosConfig.mode,
      provider: agenticosConfig.defaultProvider,
      vaultPath: agenticosConfig.vaultPath,
      databasePath: agenticosConfig.databasePath,
    },
    providers: listModelProviders().map((p) => ({ id: p.id, model: p.model })),
  };
  return NextResponse.json(credentials);
}

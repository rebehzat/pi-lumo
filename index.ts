import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const PROVIDER_ID = "lumo";
export const BASE_URL = "https://lumo.proton.me/api/ai/v1";

const FREE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as const;
const REASONING_LEVELS = {
  off: "none",
  minimal: "none",
  low: "medium",
  medium: "medium",
  high: "high",
  xhigh: "max",
} as const;

/** Models currently selectable in the Lumo app. */
export const LUMO_MODELS = [
  {
    id: "lumo-lite",
    name: "Lumo 2.0 Lite",
    reasoning: true,
    thinkingLevelMap: REASONING_LEVELS,
    input: ["text", "image"] as const,
    cost: FREE,
    contextWindow: 128_000,
    maxTokens: 16_384,
    compat: { supportsReasoningEffort: true },
  },
  {
    id: "lumo-max",
    name: "Lumo 2.0 Max",
    reasoning: true,
    thinkingLevelMap: REASONING_LEVELS,
    input: ["text", "image"] as const,
    cost: FREE,
    contextWindow: 128_000,
    maxTokens: 16_384,
    compat: { supportsReasoningEffort: true },
  },
  {
    id: "apertus-15",
    name: "Apertus 1.5",
    reasoning: false,
    input: ["text"] as const,
    cost: FREE,
    contextWindow: 128_000,
    maxTokens: 16_384,
  },
] as const;

export function getAuthConfig(env: NodeJS.ProcessEnv = process.env): {
  apiKey: string;
  headers?: Record<string, string>;
} {
  if (!env.LUMO_API_KEY && env.LUMO_TOKEN) {
    return {
      apiKey: "$LUMO_TOKEN",
      ...(env.LUMO_UID
        ? {
            headers: {
              "x-pm-uid": "$LUMO_UID",
            },
          }
        : {}),
    };
  }

  return { apiKey: "$LUMO_API_KEY" };
}

export default function lumoProvider(pi: ExtensionAPI): void {
  const auth = getAuthConfig();

  pi.registerProvider(PROVIDER_ID, {
    name: "Proton Lumo",
    baseUrl: BASE_URL,
    ...auth,
    authHeader: true,
    api: "openai-completions",
    models: LUMO_MODELS.map((model) => ({
      ...model,
      input: [...model.input],
    })),
  });
}

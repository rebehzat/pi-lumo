import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { discoverChromeCredentials } from "./chrome-auth.ts";
import { discoverChromiumCredentials } from "./chromium-auth.ts";
import { discoverFirefoxCredentials } from "./firefox-auth.ts";
import { discoverSafariCredentials } from "./safari-auth.ts";

interface BrowserCredentials {
  uid: string;
  token: string;
  profile: string;
}

/** Tries each supported browser in turn; the first live Lumo session wins. */
export function discoverBrowserCredentials(
  discoverers: Array<() => BrowserCredentials | undefined> = [
    discoverFirefoxCredentials,
    discoverChromeCredentials,
    discoverChromiumCredentials,
    discoverSafariCredentials,
  ],
): BrowserCredentials | undefined {
  for (const discover of discoverers) {
    try {
      const credentials = discover();
      if (credentials) return credentials;
    } catch {
      // An unsupported or inaccessible browser should not prevent Pi startup.
    }
  }
  return undefined;
}

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
    compat: { supportsReasoningEffort: true, supportsDeveloperRole: false },
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
    compat: { supportsReasoningEffort: true, supportsDeveloperRole: false },
  },
  {
    id: "apertus-15",
    name: "Apertus 1.5",
    reasoning: false,
    input: ["text"] as const,
    cost: FREE,
    contextWindow: 128_000,
    maxTokens: 16_384,
    compat: { supportsDeveloperRole: false },
  },
] as const;

export function getAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
  discover: () => BrowserCredentials | undefined = discoverBrowserCredentials,
): {
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

  if (!env.LUMO_API_KEY) {
    const credentials = discover();
    if (credentials) {
      return {
        apiKey: credentials.token,
        headers: {
          "x-pm-uid": credentials.uid,
        },
      };
    }
  }

  return { apiKey: "$LUMO_API_KEY" };
}

export default function lumoProvider(pi: ExtensionAPI): void {
  if (process.env.PI_LUMO_DEBUG) console.error("pi-lumo: extension loaded");
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

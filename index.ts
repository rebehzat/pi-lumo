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

/**
 * Without an `x-pm-uid` header Lumo ignores the token and treats the request
 * as an anonymous guest. So every token source is paired with a UID. When the UID has to come
 * from `LUMO_UID` and it is unset, Pi refuses to send the request and names the
 * missing variable, instead of letting Lumo answer with an opaque 403.
 */
const UID_FROM_ENV = { "x-pm-uid": "$LUMO_UID" } as const;

export function getAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
  discover: () => BrowserCredentials | undefined = discoverBrowserCredentials,
): {
  apiKey: string;
  headers: Record<string, string>;
} {
  if (!env.LUMO_API_KEY && env.LUMO_TOKEN) {
    return { apiKey: "$LUMO_TOKEN", headers: { ...UID_FROM_ENV } };
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

  // LUMO_API_KEY, or a key saved with Pi's /login (which Pi prefers over
  // apiKey): either way Lumo still needs the UID.
  return { apiKey: "$LUMO_API_KEY", headers: { ...UID_FROM_ENV } };
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

  // Lumo rejects chat requests whose body has no `lumo.client_type` with
  // 403 blocked_by_policy, signed in or not; `client_type: "api"` is rejected
  // the same way for session tokens.
  pi.on("before_provider_request", (event, ctx) => {
    if (ctx.model?.provider !== PROVIDER_ID) return undefined;
    const payload = event.payload as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object") return undefined;
    const lumo = (payload.lumo as Record<string, unknown> | undefined) ?? {};
    return { ...payload, lumo: { client_type: LUMO_CLIENT_TYPE, ...lumo } };
  });
}

export const LUMO_CLIENT_TYPE = process.env.LUMO_CLIENT_TYPE || "lumo_desktop";

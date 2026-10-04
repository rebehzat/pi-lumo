import assert from "node:assert/strict";
import test from "node:test";

import lumoProvider, {
  BASE_URL,
  discoverBrowserCredentials,
  getAuthConfig,
  LUMO_MODELS,
  PROVIDER_ID,
} from "../index.js";

test("exports all three current Lumo choices", () => {
  assert.deepEqual(
    LUMO_MODELS.map(({ id, name }) => ({ id, name })),
    [
      { id: "lumo-lite", name: "Lumo 2.0 Lite" },
      { id: "lumo-max", name: "Lumo 2.0 Max" },
      { id: "apertus-15", name: "Apertus 1.5" },
    ],
  );
});

test("registers an OpenAI-compatible provider using LUMO_API_KEY", () => {
  let registeredName: string | undefined;
  let registeredConfig: Record<string, unknown> | undefined;
  const pi = {
    registerProvider(name: string, config: Record<string, unknown>) {
      registeredName = name;
      registeredConfig = config;
    },
  };

  const previousApiKey = process.env.LUMO_API_KEY;
  process.env.LUMO_API_KEY = "test";
  try {
    lumoProvider(pi as never);
  } finally {
    if (previousApiKey === undefined) delete process.env.LUMO_API_KEY;
    else process.env.LUMO_API_KEY = previousApiKey;
  }

  assert.equal(registeredName, PROVIDER_ID);
  assert.equal(registeredConfig?.baseUrl, BASE_URL);
  assert.equal(registeredConfig?.apiKey, "$LUMO_API_KEY");
  assert.equal(registeredConfig?.authHeader, true);
  assert.equal(registeredConfig?.api, "openai-completions");
  assert.equal((registeredConfig?.models as unknown[]).length, 3);
});

test("maps Pi thinking levels to Lumo reasoning efforts", () => {
  const lite = LUMO_MODELS.find((model) => model.id === "lumo-lite");
  const max = LUMO_MODELS.find((model) => model.id === "lumo-max");
  const apertus = LUMO_MODELS.find((model) => model.id === "apertus-15");

  assert.deepEqual(lite?.thinkingLevelMap, {
    off: "none",
    minimal: "none",
    low: "medium",
    medium: "medium",
    high: "high",
    xhigh: "max",
  });
  assert.deepEqual(max?.thinkingLevelMap, lite?.thinkingLevelMap);
  assert.equal(apertus?.reasoning, false);
});

test("supports the session-token environment used by lumode", () => {
  assert.deepEqual(getAuthConfig({ LUMO_TOKEN: "secret", LUMO_UID: "uid" }), {
    apiKey: "$LUMO_TOKEN",
    headers: { "x-pm-uid": "$LUMO_UID" },
  });
  assert.deepEqual(
    getAuthConfig({ LUMO_API_KEY: "official", LUMO_TOKEN: "legacy", LUMO_UID: "uid" }),
    { apiKey: "$LUMO_API_KEY" },
  );
});

test("uses discovered browser credentials only when environment credentials are absent", () => {
  const discover = () => ({ uid: "browser-uid", token: "browser-token", profile: "/profile/cookies.sqlite" });

  assert.deepEqual(getAuthConfig({}, discover), {
    apiKey: "browser-token",
    headers: { "x-pm-uid": "browser-uid" },
  });
  assert.deepEqual(getAuthConfig({ LUMO_API_KEY: "official" }, discover), {
    apiKey: "$LUMO_API_KEY",
  });
});

test("discoverBrowserCredentials tries each browser in order until one succeeds", () => {
  const calls: string[] = [];
  const credentials = discoverBrowserCredentials([
    () => {
      calls.push("firefox");
      return undefined;
    },
    () => {
      calls.push("chrome");
      return { uid: "chrome-uid", token: "chrome-token", profile: "/profile/Cookies" };
    },
    () => {
      calls.push("safari");
      return { uid: "safari-uid", token: "safari-token", profile: "/profile/Cookies.binarycookies" };
    },
  ]);

  assert.deepEqual(calls, ["firefox", "chrome"]);
  assert.deepEqual(credentials, { uid: "chrome-uid", token: "chrome-token", profile: "/profile/Cookies" });
});

test("discoverBrowserCredentials survives a browser discoverer that throws", () => {
  const credentials = discoverBrowserCredentials([
    () => {
      throw new Error("locked profile");
    },
    () => ({ uid: "safari-uid", token: "safari-token", profile: "/profile/Cookies.binarycookies" }),
  ]);

  assert.deepEqual(credentials, { uid: "safari-uid", token: "safari-token", profile: "/profile/Cookies.binarycookies" });
});

test("discoverBrowserCredentials() wires up Firefox, Chrome, Chromium, and Safari by default without throwing", () => {
  assert.doesNotThrow(() => discoverBrowserCredentials());
});

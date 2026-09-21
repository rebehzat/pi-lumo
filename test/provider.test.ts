import assert from "node:assert/strict";
import test from "node:test";

import lumoProvider, { BASE_URL, getAuthConfig, LUMO_MODELS, PROVIDER_ID } from "../index.js";

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

test("uses discovered Firefox credentials only when environment credentials are absent", () => {
  const discover = () => ({ uid: "firefox-uid", token: "firefox-token", profile: "/profile/cookies.sqlite" });

  assert.deepEqual(getAuthConfig({}, discover), {
    apiKey: "firefox-token",
    headers: { "x-pm-uid": "firefox-uid" },
  });
  assert.deepEqual(getAuthConfig({ LUMO_API_KEY: "official" }, discover), {
    apiKey: "$LUMO_API_KEY",
  });
});

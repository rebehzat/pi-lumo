import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { credentialsFromCookies, firefoxProfileRoots } from "../firefox-auth.js";

test("searches standard, XDG, Snap, and Flatpak Firefox locations", () => {
  const roots = firefoxProfileRoots("/home/tester", "/custom/config");

  assert.ok(roots.includes(join("/home/tester", ".mozilla", "firefox")));
  assert.ok(roots.includes(join("/custom/config", "mozilla", "firefox")));
  assert.ok(roots.includes(join("/home/tester", "snap", "firefox", "common", ".mozilla", "firefox")));
  assert.ok(roots.includes(join("/home/tester", ".var", "app", "org.mozilla.firefox", ".mozilla", "firefox")));
  assert.ok(roots.includes(join("/home/tester", ".var", "app", "org.mozilla.FirefoxDeveloperEdition", ".mozilla", "firefox")));
});

test("includes Windows APPDATA Firefox roots when APPDATA is set", () => {
  const roots = firefoxProfileRoots("/home/tester", "/custom/config", "C:\\Users\\tester\\AppData\\Roaming");

  assert.ok(roots.includes(join("C:\\Users\\tester\\AppData\\Roaming", "Mozilla", "Firefox", "Profiles")));
  assert.ok(roots.includes(join("C:\\Users\\tester\\AppData\\Roaming", "LibreWolf", "Profiles")));
});

test("omits Windows roots when APPDATA is unset", () => {
  const saved = process.env.APPDATA;
  delete process.env.APPDATA;
  try {
    const roots = firefoxProfileRoots("/home/tester", "/custom/config");
    assert.ok(!roots.some((root) => root.includes("Mozilla")));
    assert.ok(!roots.some((root) => root.includes("LibreWolf")));
  } finally {
    if (saved !== undefined) process.env.APPDATA = saved;
  }
});

test("extracts a UID and token without persisting either", () => {
  assert.deepEqual(
    credentialsFromCookies(
      [
        { name: "unrelated", value: "ignore" },
        { name: "AUTH-user-id", value: "access-token" },
      ],
      "/profile/cookies.sqlite",
    ),
    {
      uid: "user-id",
      token: "access-token",
      profile: "/profile/cookies.sqlite",
    },
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { credentialsFromCookies, firefoxProfileRoots } from "../firefox-auth.js";

test("searches standard, XDG, Snap, and Flatpak Firefox locations", () => {
  const roots = firefoxProfileRoots("/home/tester", "/custom/config");

  assert.ok(roots.includes("/home/tester/.mozilla/firefox"));
  assert.ok(roots.includes("/custom/config/mozilla/firefox"));
  assert.ok(roots.includes("/home/tester/snap/firefox/common/.mozilla/firefox"));
  assert.ok(roots.includes("/home/tester/.var/app/org.mozilla.firefox/.mozilla/firefox"));
  assert.ok(roots.includes("/home/tester/.var/app/org.mozilla.FirefoxDeveloperEdition/.mozilla/firefox"));
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

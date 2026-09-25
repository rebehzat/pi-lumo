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

test("searches the macOS Application Support directory on darwin", () => {
  const roots = firefoxProfileRoots("/Users/tester", undefined, "darwin");

  assert.deepEqual(roots, ["/Users/tester/Library/Application Support/Firefox/Profiles"]);
});

test("honors LUMO_FIREFOX_PROFILE on darwin too", () => {
  const previous = process.env.LUMO_FIREFOX_PROFILE;
  process.env.LUMO_FIREFOX_PROFILE = "/custom/profile";
  try {
    assert.deepEqual(firefoxProfileRoots("/Users/tester", undefined, "darwin"), [
      "/custom/profile",
      "/Users/tester/Library/Application Support/Firefox/Profiles",
    ]);
  } finally {
    if (previous === undefined) delete process.env.LUMO_FIREFOX_PROFILE;
    else process.env.LUMO_FIREFOX_PROFILE = previous;
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

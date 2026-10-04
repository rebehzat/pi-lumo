import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { credentialsFromCookies, firefoxProfileRoots } from "../firefox-auth.js";

test("searches standard, XDG, Snap, and Flatpak Firefox locations", () => {
  const roots = firefoxProfileRoots("/home/tester", "/custom/config", "linux");

  assert.ok(roots.includes(join("/home/tester", ".mozilla", "firefox")));
  assert.ok(roots.includes(join("/custom/config", "mozilla", "firefox")));
  assert.ok(roots.includes(join("/home/tester", "snap", "firefox", "common", ".mozilla", "firefox")));
  assert.ok(roots.includes(join("/home/tester", ".var", "app", "org.mozilla.firefox", ".mozilla", "firefox")));
  assert.ok(roots.includes(join("/home/tester", ".var", "app", "org.mozilla.FirefoxDeveloperEdition", ".mozilla", "firefox")));
});

test("searches the macOS Application Support directory on darwin", () => {
  const roots = firefoxProfileRoots("/Users/tester", undefined, "darwin");

  assert.deepEqual(roots, [join("/Users/tester", "Library", "Application Support", "Firefox", "Profiles")]);
});

test("includes Windows APPDATA Firefox roots when APPDATA is set", () => {
  const saved = process.env.APPDATA;
  process.env.APPDATA = "C:\\Users\\tester\\AppData\\Roaming";
  try {
    const roots = firefoxProfileRoots("C:\\Users\\tester", undefined, "win32");

    assert.ok(roots.includes(join("C:\\Users\\tester\\AppData\\Roaming", "Mozilla", "Firefox", "Profiles")));
    assert.ok(roots.includes(join("C:\\Users\\tester\\AppData\\Roaming", "LibreWolf", "Profiles")));
  } finally {
    if (saved === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = saved;
  }
});

test("omits Windows roots when APPDATA is unset", () => {
  const saved = process.env.APPDATA;
  delete process.env.APPDATA;
  try {
    const roots = firefoxProfileRoots("C:\\Users\\tester", undefined, "win32");
    assert.deepEqual(roots, []);
  } finally {
    if (saved !== undefined) process.env.APPDATA = saved;
  }
});

test("honors LUMO_FIREFOX_PROFILE on darwin too", () => {
  const previous = process.env.LUMO_FIREFOX_PROFILE;
  process.env.LUMO_FIREFOX_PROFILE = "/custom/profile";
  try {
    assert.deepEqual(firefoxProfileRoots("/Users/tester", undefined, "darwin"), [
      "/custom/profile",
      join("/Users/tester", "Library", "Application Support", "Firefox", "Profiles"),
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

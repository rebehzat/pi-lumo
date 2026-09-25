import assert from "node:assert/strict";
import test from "node:test";

import { chromeProfileRoots } from "../chrome-auth.js";

test("uses the macOS Application Support directory on darwin", () => {
  const roots = chromeProfileRoots("/Users/tester", undefined, "darwin");
  assert.deepEqual(roots, ["/Users/tester/Library/Application Support/Google/Chrome"]);
});

test("searches XDG and Flatpak Chrome locations on Linux", () => {
  const roots = chromeProfileRoots("/home/tester", "/custom/config", "linux");
  assert.ok(roots.includes("/custom/config/google-chrome"));
  assert.ok(roots.includes("/home/tester/.var/app/com.google.Chrome/config/google-chrome"));
});

test("honors LUMO_CHROME_PROFILE as an additional root", () => {
  const previous = process.env.LUMO_CHROME_PROFILE;
  process.env.LUMO_CHROME_PROFILE = "/custom/profile";
  try {
    assert.ok(chromeProfileRoots("/home/tester", undefined, "linux").includes("/custom/profile"));
  } finally {
    if (previous === undefined) delete process.env.LUMO_CHROME_PROFILE;
    else process.env.LUMO_CHROME_PROFILE = previous;
  }
});

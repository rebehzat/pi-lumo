import assert from "node:assert/strict";
import test from "node:test";

import { chromiumProfileRoots } from "../chromium-auth.js";

test("uses the macOS Application Support directory on darwin", () => {
  const roots = chromiumProfileRoots("/Users/tester", undefined, "darwin");
  assert.deepEqual(roots, ["/Users/tester/Library/Application Support/Chromium"]);
});

test("searches XDG, Flatpak, and Snap Chromium locations on Linux", () => {
  const roots = chromiumProfileRoots("/home/tester", "/custom/config", "linux");
  assert.ok(roots.includes("/custom/config/chromium"));
  assert.ok(roots.includes("/home/tester/.var/app/org.chromium.Chromium/config/chromium"));
  assert.ok(roots.includes("/home/tester/snap/chromium/common/chromium"));
});

test("honors LUMO_CHROMIUM_PROFILE as an additional root", () => {
  const previous = process.env.LUMO_CHROMIUM_PROFILE;
  process.env.LUMO_CHROMIUM_PROFILE = "/custom/profile";
  try {
    assert.ok(chromiumProfileRoots("/home/tester", undefined, "linux").includes("/custom/profile"));
  } finally {
    if (previous === undefined) delete process.env.LUMO_CHROMIUM_PROFILE;
    else process.env.LUMO_CHROMIUM_PROFILE = previous;
  }
});

test("ignores Chrome's profile override and never produces Chrome's paths", () => {
  const previous = process.env.LUMO_CHROME_PROFILE;
  process.env.LUMO_CHROME_PROFILE = "/custom/chrome-only-profile";
  try {
    const roots = chromiumProfileRoots("/home/tester", "/custom/config", "linux");
    assert.ok(!roots.includes("/custom/chrome-only-profile"));
    assert.ok(!roots.includes("/custom/config/google-chrome"));
  } finally {
    if (previous === undefined) delete process.env.LUMO_CHROME_PROFILE;
    else process.env.LUMO_CHROME_PROFILE = previous;
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import { isLumoCookieDomain } from "../lumo-domain.js";

test("matches the exact host and dot-prefixed domain-wide cookies", () => {
  assert.equal(isLumoCookieDomain("lumo.proton.me"), true);
  assert.equal(isLumoCookieDomain(".lumo.proton.me"), true);
  assert.equal(isLumoCookieDomain("chat.lumo.proton.me"), true);
});

test("rejects look-alike hosts without a proper domain boundary", () => {
  assert.equal(isLumoCookieDomain("evillumo.proton.me"), false);
  assert.equal(isLumoCookieDomain("lumo.proton.me.evil.com"), false);
  assert.equal(isLumoCookieDomain("notlumo.proton.me"), false);
  assert.equal(isLumoCookieDomain(""), false);
});

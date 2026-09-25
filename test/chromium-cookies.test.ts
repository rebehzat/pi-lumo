import assert from "node:assert/strict";
import { createCipheriv, pbkdf2Sync } from "node:crypto";
import test from "node:test";

import { credentialsFromCookieValues, decryptChromiumValue, deriveChromiumKey } from "../chromium-cookies.js";

test("extracts a UID and token without persisting either", () => {
  assert.deepEqual(
    credentialsFromCookieValues(
      [
        { host: "lumo.proton.me", name: "unrelated", value: "ignore" },
        { host: "lumo.proton.me", name: "AUTH-user-id", value: "access-token" },
      ],
      "/profile/Cookies",
    ),
    {
      uid: "user-id",
      token: "access-token",
      profile: "/profile/Cookies",
    },
  );
});

test("accepts a leading-dot domain cookie but rejects a look-alike host", () => {
  assert.deepEqual(
    credentialsFromCookieValues(
      [{ host: ".lumo.proton.me", name: "AUTH-user-id", value: "access-token" }],
      "/profile/Cookies",
    ),
    { uid: "user-id", token: "access-token", profile: "/profile/Cookies" },
  );

  assert.equal(
    credentialsFromCookieValues(
      [{ host: "evillumo.proton.me", name: "AUTH-user-id", value: "access-token" }],
      "/profile/Cookies",
    ),
    undefined,
  );
});

test("decrypts a v10-encrypted cookie value using Chromium's OSCrypt scheme", () => {
  const key = deriveChromiumKey("test-password", "linux");
  const iv = Buffer.alloc(16, 0x20);
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  const ciphertext = Buffer.concat([cipher.update("secret-token", "utf8"), cipher.final()]);
  const blob = Buffer.concat([Buffer.from("v10", "ascii"), ciphertext]);

  assert.equal(decryptChromiumValue(blob, key), "secret-token");
});

test("rejects blobs without a recognized OSCrypt version prefix", () => {
  const key = deriveChromiumKey("test-password", "linux");
  assert.equal(decryptChromiumValue(Buffer.from("plain-value", "utf8"), key), undefined);
});

test("uses distinct PBKDF2 iteration counts per platform", () => {
  const macKey = pbkdf2Sync("password", "saltysalt", 1003, 16, "sha1");
  const linuxKey = pbkdf2Sync("password", "saltysalt", 1, 16, "sha1");

  assert.deepEqual(deriveChromiumKey("password", "darwin"), macKey);
  assert.deepEqual(deriveChromiumKey("password", "linux"), linuxKey);
  assert.notDeepEqual(macKey, linuxKey);
});

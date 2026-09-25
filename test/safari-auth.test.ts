import assert from "node:assert/strict";
import test from "node:test";

import { credentialsFromSafariCookies, parseBinaryCookies, safariCookieFiles } from "../safari-auth.js";

function encodeCookieRecord(domain: string, name: string, value: string): Buffer {
  const domainBuffer = Buffer.from(`${domain}\0`, "utf8");
  const nameBuffer = Buffer.from(`${name}\0`, "utf8");
  const pathBuffer = Buffer.from("/\0", "utf8");
  const valueBuffer = Buffer.from(`${value}\0`, "utf8");

  const headerSize = 56;
  const domainOffset = headerSize;
  const nameOffset = domainOffset + domainBuffer.length;
  const pathOffset = nameOffset + nameBuffer.length;
  const valueOffset = pathOffset + pathBuffer.length;
  const recordSize = valueOffset + valueBuffer.length;

  const record = Buffer.alloc(recordSize);
  record.writeUInt32LE(recordSize, 0); // cookie size
  record.writeUInt32LE(0, 4); // unknown
  record.writeUInt32LE(0, 8); // flags
  record.writeUInt32LE(0, 12); // unknown
  record.writeUInt32LE(domainOffset, 16);
  record.writeUInt32LE(nameOffset, 20);
  record.writeUInt32LE(pathOffset, 24);
  record.writeUInt32LE(valueOffset, 28);
  // bytes 32-55: end-of-record marker + expiry/creation doubles (unused by the parser)

  domainBuffer.copy(record, domainOffset);
  nameBuffer.copy(record, nameOffset);
  pathBuffer.copy(record, pathOffset);
  valueBuffer.copy(record, valueOffset);

  return record;
}

function encodePage(records: Buffer[]): Buffer {
  const offsetsSize = records.length * 4;
  const headerSize = 8 + offsetsSize;
  const totalSize = headerSize + records.reduce((sum, r) => sum + r.length, 0);

  const page = Buffer.alloc(totalSize);
  page.writeUInt32LE(0x00000100, 0);
  page.writeUInt32LE(records.length, 4);

  let cursor = headerSize;
  records.forEach((record, i) => {
    page.writeUInt32LE(cursor, 8 + i * 4);
    record.copy(page, cursor);
    cursor += record.length;
  });

  return page;
}

function encodeBinaryCookies(pages: Buffer[]): Buffer {
  const header = Buffer.alloc(8 + pages.length * 4);
  header.write("cook", 0, "ascii");
  header.writeUInt32BE(pages.length, 4);
  pages.forEach((page, i) => header.writeUInt32BE(page.length, 8 + i * 4));

  return Buffer.concat([header, ...pages]);
}

test("parses domain, name, and value out of a synthetic binarycookies file", () => {
  const record = encodeCookieRecord("lumo.proton.me", "AUTH-user-id", "access-token");
  const page = encodePage([record]);
  const buffer = encodeBinaryCookies([page]);

  const cookies = parseBinaryCookies(buffer);
  assert.deepEqual(cookies, [{ domain: "lumo.proton.me", name: "AUTH-user-id", value: "access-token" }]);
});

test("parses multiple pages and multiple cookies per page", () => {
  const pageOne = encodePage([
    encodeCookieRecord("example.com", "session", "irrelevant"),
    encodeCookieRecord(".lumo.proton.me", "AUTH-abc", "token-1"),
  ]);
  const pageTwo = encodePage([encodeCookieRecord("lumo.proton.me", "AUTH-xyz", "token-2")]);
  const buffer = encodeBinaryCookies([pageOne, pageTwo]);

  const cookies = parseBinaryCookies(buffer);
  assert.equal(cookies.length, 3);
  assert.ok(cookies.some((c) => c.name === "AUTH-abc" && c.value === "token-1"));
  assert.ok(cookies.some((c) => c.name === "AUTH-xyz" && c.value === "token-2"));
});

test("returns an empty list for a buffer missing the 'cook' magic", () => {
  assert.deepEqual(parseBinaryCookies(Buffer.from("not-a-cookie-file")), []);
});

test("extracts a UID and token without persisting either", () => {
  assert.deepEqual(
    credentialsFromSafariCookies(
      [
        { domain: "example.com", name: "unrelated", value: "ignore" },
        { domain: ".lumo.proton.me", name: "AUTH-user-id", value: "access-token" },
      ],
      "/profile/Cookies.binarycookies",
    ),
    {
      uid: "user-id",
      token: "access-token",
      profile: "/profile/Cookies.binarycookies",
    },
  );
});

test("rejects a look-alike domain that merely contains the Lumo hostname", () => {
  assert.equal(
    credentialsFromSafariCookies(
      [{ domain: "evillumo.proton.me", name: "AUTH-user-id", value: "access-token" }],
      "/profile/Cookies.binarycookies",
    ),
    undefined,
  );
});

test("honors LUMO_SAFARI_COOKIES as an override path", () => {
  const previous = process.env.LUMO_SAFARI_COOKIES;
  process.env.LUMO_SAFARI_COOKIES = "/custom/Cookies.binarycookies";
  try {
    assert.deepEqual(safariCookieFiles("/Users/tester"), ["/custom/Cookies.binarycookies"]);
  } finally {
    if (previous === undefined) delete process.env.LUMO_SAFARI_COOKIES;
    else process.env.LUMO_SAFARI_COOKIES = previous;
  }
});

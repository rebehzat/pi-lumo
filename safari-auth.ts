import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { isLumoCookieDomain } from "./lumo-domain.ts";

export interface SafariCredentials {
  uid: string;
  token: string;
  profile: string;
}

export interface SafariCookie {
  domain: string;
  name: string;
  value: string;
}

export function safariCookieFiles(home = homedir()): string[] {
  if (process.env.LUMO_SAFARI_COOKIES) return [process.env.LUMO_SAFARI_COOKIES];

  return [
    join(home, "Library", "Containers", "com.apple.Safari", "Data", "Library", "Cookies", "Cookies.binarycookies"),
    join(home, "Library", "Cookies", "Cookies.binarycookies"),
  ].filter((path) => existsSync(path));
}

function readNullTerminatedString(buffer: Buffer, offset: number): string {
  let end = offset;
  while (end < buffer.length && buffer[end] !== 0) end++;
  return buffer.toString("utf8", offset, end);
}

function parseCookieRecord(record: Buffer): SafariCookie | undefined {
  if (record.length < 32) return undefined;

  const domainOffset = record.readUInt32LE(16);
  const nameOffset = record.readUInt32LE(20);
  const valueOffset = record.readUInt32LE(28);
  if (domainOffset >= record.length || nameOffset >= record.length || valueOffset >= record.length) {
    return undefined;
  }

  return {
    domain: readNullTerminatedString(record, domainOffset),
    name: readNullTerminatedString(record, nameOffset),
    value: readNullTerminatedString(record, valueOffset),
  };
}

function parsePage(page: Buffer): SafariCookie[] {
  const cookies: SafariCookie[] = [];
  if (page.length < 8) return cookies;

  const cookieCount = page.readUInt32LE(4);
  for (let i = 0; i < cookieCount; i++) {
    const offsetPos = 8 + i * 4;
    if (offsetPos + 4 > page.length) break;
    const cookieOffset = page.readUInt32LE(offsetPos);
    if (cookieOffset + 4 > page.length) continue;
    const recordSize = page.readUInt32LE(cookieOffset);
    if (cookieOffset + recordSize > page.length) continue;
    const cookie = parseCookieRecord(page.subarray(cookieOffset, cookieOffset + recordSize));
    if (cookie) cookies.push(cookie);
  }

  return cookies;
}

/** Parses Safari's proprietary "Cookies.binarycookies" container format. */
export function parseBinaryCookies(buffer: Buffer): SafariCookie[] {
  if (buffer.length < 8 || buffer.toString("ascii", 0, 4) !== "cook") return [];

  const pageCount = buffer.readUInt32BE(4);
  const pageSizes: number[] = [];
  let cursor = 8;
  for (let i = 0; i < pageCount; i++) {
    if (cursor + 4 > buffer.length) return [];
    pageSizes.push(buffer.readUInt32BE(cursor));
    cursor += 4;
  }

  const cookies: SafariCookie[] = [];
  for (const size of pageSizes) {
    if (cursor + size > buffer.length) break;
    cookies.push(...parsePage(buffer.subarray(cursor, cursor + size)));
    cursor += size;
  }

  return cookies;
}

export function credentialsFromSafariCookies(
  cookies: SafariCookie[],
  profile: string,
): SafariCredentials | undefined {
  for (const cookie of cookies) {
    if (!isLumoCookieDomain(cookie.domain)) continue;
    if (!cookie.name.startsWith("AUTH-") || !cookie.value) continue;
    const uid = cookie.name.slice("AUTH-".length);
    if (uid) return { uid, token: cookie.value, profile };
  }
  return undefined;
}

export function discoverSafariCredentials(
  files = safariCookieFiles(),
): SafariCredentials | undefined {
  for (const file of files) {
    try {
      const cookies = parseBinaryCookies(readFileSync(file));
      const credentials = credentialsFromSafariCookies(cookies, file);
      if (credentials) return credentials;
    } catch {
      // A locked, stale, or inaccessible (e.g. missing Full Disk Access) file should not prevent Pi startup.
    }
  }
  return undefined;
}

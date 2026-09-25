import { execFileSync } from "node:child_process";
import { createDecipheriv, pbkdf2Sync } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { isLumoCookieDomain } from "./lumo-domain.ts";
import { querySqliteRows } from "./sqlite-cookies.ts";

/**
 * Shared cookie-discovery engine for Chromium-family browsers (Chrome, Chromium, and
 * any other browser using the same on-disk Cookies database and OSCrypt "Safe Storage"
 * encryption scheme). Each browser supplies its own {@link ChromiumBrowserConfig}.
 */

export interface ChromiumCredentials {
  uid: string;
  token: string;
  profile: string;
}

export interface ChromiumBrowserConfig {
  /** macOS Keychain generic-password service name, e.g. "Chrome Safe Storage". */
  keychainServiceName: string;
  /** Linux libsecret "application" attribute, e.g. "chrome". */
  secretToolApplication: string;
  /** Path segments under `~/Library/Application Support`, e.g. ["Google", "Chrome"]. */
  macAppSupportPath: string[];
  /** Directory name under `$XDG_CONFIG_HOME`, e.g. "google-chrome". */
  linuxConfigDirName: string;
  /** Flatpak application id, e.g. "com.google.Chrome". */
  flatpakAppId: string;
  /** Common directory name under `~/snap/<name>/common`, when an official snap exists. */
  snapName?: string;
  /** Environment variable name for a manual profile override, e.g. "LUMO_CHROME_PROFILE". */
  profileEnvVar: string;
  /** Namespaces locked-database temp snapshots, e.g. "pi-lumo-chrome-". */
  snapshotPrefix: string;
}

interface ChromiumCookieRow {
  host_key: string;
  name: string;
  value_hex: string;
  encrypted_hex: string;
}

const SAFE_STORAGE_SALT = "saltysalt";
const SAFE_STORAGE_IV = Buffer.alloc(16, 0x20);
const SAFE_STORAGE_KEY_LENGTH = 16;
/** Chromium's PBKDF2 iteration counts differ by OS keychain implementation. */
const SAFE_STORAGE_ITERATIONS: Record<string, number> = { darwin: 1003, linux: 1 };

export function profileRootsForBrowser(
  config: ChromiumBrowserConfig,
  home = homedir(),
  xdgConfigHome = process.env.XDG_CONFIG_HOME,
  currentPlatform: NodeJS.Platform = platform(),
): string[] {
  const roots =
    currentPlatform === "darwin"
      ? [join(home, "Library", "Application Support", ...config.macAppSupportPath)]
      : [
          join(xdgConfigHome || join(home, ".config"), config.linuxConfigDirName),
          join(home, ".var", "app", config.flatpakAppId, "config", config.linuxConfigDirName),
          ...(config.snapName
            ? [join(home, "snap", config.snapName, "common", config.linuxConfigDirName)]
            : []),
        ];

  return [process.env[config.profileEnvVar], ...roots].filter((path): path is string => Boolean(path));
}

function cookieFilesIn(profileDirectory: string): string[] {
  const files: string[] = [];
  const legacy = join(profileDirectory, "Cookies");
  if (existsSync(legacy)) files.push(legacy);
  const networked = join(profileDirectory, "Network", "Cookies");
  if (existsSync(networked)) files.push(networked);
  return files;
}

export function cookieDatabasesForBrowser(roots: string[]): string[] {
  const databases = new Set<string>();

  for (const root of roots) {
    if (!existsSync(root)) continue;

    for (const file of cookieFilesIn(root)) databases.add(file);

    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      for (const file of cookieFilesIn(join(root, entry.name))) databases.add(file);
    }
  }

  return [...databases];
}

/** Reads the browser's "Safe Storage" password from the OS keychain, prompting the user if needed. */
export function safeStoragePasswordForBrowser(
  config: ChromiumBrowserConfig,
  currentPlatform: NodeJS.Platform = platform(),
): string {
  try {
    if (currentPlatform === "darwin") {
      return execFileSync("security", ["find-generic-password", "-w", "-s", config.keychainServiceName], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5_000,
      }).trim();
    }

    const password = execFileSync("secret-tool", ["lookup", "application", config.secretToolApplication], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    }).trim();
    if (password) return password;
  } catch {
    // No keychain/keyring entry available; fall through to Chromium's documented default.
  }

  return "peanuts";
}

export function deriveChromiumKey(password: string, currentPlatform: NodeJS.Platform = platform()): Buffer {
  const iterations = SAFE_STORAGE_ITERATIONS[currentPlatform] ?? 1;
  return pbkdf2Sync(password, SAFE_STORAGE_SALT, iterations, SAFE_STORAGE_KEY_LENGTH, "sha1");
}

export function decryptChromiumValue(blob: Buffer, key: Buffer): string | undefined {
  const prefix = blob.subarray(0, 3).toString("ascii");
  if (prefix !== "v10" && prefix !== "v11") return undefined;

  try {
    const decipher = createDecipheriv("aes-128-cbc", key, SAFE_STORAGE_IV);
    const decrypted = Buffer.concat([decipher.update(blob.subarray(3)), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return undefined;
  }
}

export function credentialsFromCookieValues(
  values: Array<{ host: string; name: string; value: string }>,
  profile: string,
): ChromiumCredentials | undefined {
  for (const { host, name, value } of values) {
    if (!isLumoCookieDomain(host)) continue;
    if (!name.startsWith("AUTH-") || !value) continue;
    const uid = name.slice("AUTH-".length);
    if (uid) return { uid, token: value, profile };
  }
  return undefined;
}

const COOKIE_QUERY = `SELECT host_key, name, hex(value) AS value_hex, hex(encrypted_value) AS encrypted_hex
                         FROM cookies
                        WHERE name LIKE 'AUTH-%'
                        ORDER BY expires_utc DESC`;

function decodeCookieValue(row: ChromiumCookieRow, key: Buffer): string | undefined {
  if (row.value_hex) return Buffer.from(row.value_hex, "hex").toString("utf8");
  if (!row.encrypted_hex) return undefined;
  return decryptChromiumValue(Buffer.from(row.encrypted_hex, "hex"), key);
}

export function discoverCredentialsForBrowser(
  config: ChromiumBrowserConfig,
  databases = cookieDatabasesForBrowser(profileRootsForBrowser(config)),
): ChromiumCredentials | undefined {
  let key: Buffer | undefined;

  for (const databasePath of databases) {
    try {
      key ??= deriveChromiumKey(safeStoragePasswordForBrowser(config));
      const rows = querySqliteRows<ChromiumCookieRow>(databasePath, COOKIE_QUERY, config.snapshotPrefix);
      const values = rows
        .map((row) => ({ host: row.host_key, name: row.name, value: decodeCookieValue(row, key as Buffer) }))
        .filter((entry): entry is { host: string; name: string; value: string } => Boolean(entry.value));
      const credentials = credentialsFromCookieValues(values, databasePath);
      if (credentials) return credentials;
    } catch {
      // A locked, stale, or incompatible profile should not prevent Pi startup.
    }
  }

  return undefined;
}

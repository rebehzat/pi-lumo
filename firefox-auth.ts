import { chmodSync, copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface FirefoxCredentials {
  uid: string;
  token: string;
  profile: string;
}

interface CookieRow {
  name: string;
  value: string;
}

export function firefoxProfileRoots(
  home = homedir(),
  xdgConfigHome = process.env.XDG_CONFIG_HOME,
): string[] {
  const configHome = xdgConfigHome || join(home, ".config");
  return [
    process.env.LUMO_FIREFOX_PROFILE,
    join(home, ".mozilla", "firefox"),
    join(configHome, "mozilla", "firefox"),
    join(home, "snap", "firefox", "common", ".mozilla", "firefox"),
    join(home, ".var", "app", "org.mozilla.firefox", ".mozilla", "firefox"),
    join(home, ".var", "app", "org.mozilla.FirefoxDeveloperEdition", ".mozilla", "firefox"),
  ].filter((path): path is string => Boolean(path));
}

export function cookieDatabases(roots = firefoxProfileRoots()): string[] {
  const databases = new Set<string>();

  for (const root of roots) {
    if (!existsSync(root)) continue;

    const directDatabase = join(root, "cookies.sqlite");
    if (existsSync(directDatabase)) databases.add(directDatabase);

    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const database = join(root, entry.name, "cookies.sqlite");
      if (existsSync(database)) databases.add(database);
    }
  }

  return [...databases];
}

export function credentialsFromCookies(rows: CookieRow[], profile: string): FirefoxCredentials | undefined {
  for (const row of rows) {
    if (!row.name.startsWith("AUTH-") || !row.value) continue;
    const uid = row.name.slice("AUTH-".length);
    if (uid) return { uid, token: row.value, profile };
  }
  return undefined;
}

const COOKIE_QUERY = `SELECT name, value
                        FROM moz_cookies
                       WHERE host LIKE '%lumo.proton.me'
                         AND name LIKE 'AUTH-%'
                       ORDER BY expiry DESC`;

function readCookieRows(databasePath: string): CookieRow[] {
  let database: DatabaseSync | undefined;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true });
    return database.prepare(COOKIE_QUERY).all() as unknown as CookieRow[];
  } catch {
    database?.close();
    database = undefined;

    const snapshotDirectory = mkdtempSync(join(tmpdir(), "pi-lumo-firefox-"));
    chmodSync(snapshotDirectory, 0o700);
    const snapshotPath = join(snapshotDirectory, "cookies.sqlite");
    try {
      copyFileSync(databasePath, snapshotPath);
      chmodSync(snapshotPath, 0o600);
      database = new DatabaseSync(snapshotPath, { readOnly: true });
      return database.prepare(COOKIE_QUERY).all() as unknown as CookieRow[];
    } finally {
      database?.close();
      database = undefined;
      rmSync(snapshotDirectory, { recursive: true, force: true });
    }
  } finally {
    database?.close();
  }
}

export function discoverFirefoxCredentials(
  databases = cookieDatabases(),
): FirefoxCredentials | undefined {
  for (const databasePath of databases) {
    try {
      const rows = readCookieRows(databasePath);
      const credentials = credentialsFromCookies(rows, databasePath);
      if (credentials) return credentials;
    } catch {
      // A locked, stale, or incompatible profile should not prevent Pi startup.
    }
  }
  return undefined;
}

import assert from "node:assert/strict";
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { querySqliteRows } from "../sqlite-cookies.js";

const TEST_PREFIX = "pi-lumo-sqlite-wal-test-";

/**
 * Creates a cookie database whose schema lives in the checkpointed main
 * file, then returns a writer that keeps a connection open in WAL mode.
 * While the writer is open, its committed transactions exist only in the
 * WAL — exactly how a running browser leaves its cookie database behind.
 * Each write() resolves only after the CLI acknowledges the statement has
 * run, so tests never race ahead of the writer.
 */
function openWalWriter(dbPath: string): {
  write: (sql: string) => Promise<void>;
  close: () => Promise<void>;
} {
  execSync(`sqlite3 "${dbPath}" "PRAGMA journal_mode=WAL; CREATE TABLE moz_cookies (name TEXT, value TEXT, host TEXT);"`);
  const child = spawn("sqlite3", [dbPath], { stdio: ["pipe", "pipe", "ignore"] });
  let ackCounter = 0;
  let pendingAck: (() => void) | undefined;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", () => {
    ackCounter += 1;
    pendingAck?.();
  });
  const write = async (sql: string): Promise<void> => {
    const acksSeen = ackCounter;
    // .print emits a line on stdout once the preceding statement has run,
    // giving us a reliable acknowledgment that the write is committed.
    child.stdin.write(`${sql};\n.print __WRITE_ACK__\n`);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("writer did not acknowledge statement")), 5_000);
      pendingAck = () => {
        if (ackCounter > acksSeen) {
          clearTimeout(timer);
          pendingAck = undefined;
          resolve();
        }
      };
    });
  };
  const close = async (): Promise<void> => {
    child.stdin.end(".exit\n");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve();
      }, 5_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    // Give Windows a beat to release the file handles before cleanup.
    await new Promise((resolve) => setTimeout(resolve, 50));
  };
  return { write, close };
}

test("WAL-only insert is visible through mode=ro but not immutable", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), TEST_PREFIX));
  const dbPath = join(tempDir, "cookies.sqlite");
  const writer = openWalWriter(dbPath);

  try {
    // Committed while the writer is open, so this row exists only in the WAL.
    await writer.write("INSERT INTO moz_cookies (name, value, host) VALUES ('AUTH-test1', 'wal-token-1', 'lumo.proton.me')");

    // immutable=1 must miss the WAL-only row — this documents the hazard
    // that motivated switching the primary read to mode=ro.
    const immutableOutput = execSync(
      `sqlite3 -json "file:${dbPath}?immutable=1" "SELECT value FROM moz_cookies WHERE name='AUTH-test1'"`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const immutableResult = immutableOutput.trim() ? JSON.parse(immutableOutput) : [];
    assert.equal(immutableResult.length, 0, "immutable should miss WAL-only insert");

    // The primary read path must see the WAL-only row.
    const roResult = querySqliteRows<{ name: string; value: string }>(
      dbPath,
      "SELECT name, value FROM moz_cookies WHERE name='AUTH-test1'",
      TEST_PREFIX,
    );
    assert.equal(roResult.length, 1, "mode=ro should see WAL-only insert");
    assert.equal(roResult[0].value, "wal-token-1");
  } finally {
    await writer.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("WAL-only refresh updates the result through mode=ro", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), TEST_PREFIX));
  const dbPath = join(tempDir, "cookies.sqlite");
  const writer = openWalWriter(dbPath);

  try {
    await writer.write("INSERT INTO moz_cookies (name, value, host) VALUES ('AUTH-test2', 'initial-token', 'lumo.proton.me')");
    await writer.write("UPDATE moz_cookies SET value='refreshed-token' WHERE name='AUTH-test2'");

    // The refresh exists only in the WAL; mode=ro must return the new
    // token, not the stale main-file value (which doesn't exist at all
    // here since even the insert is WAL-only).
    const refreshed = querySqliteRows<{ name: string; value: string }>(
      dbPath,
      "SELECT name, value FROM moz_cookies WHERE name='AUTH-test2'",
      TEST_PREFIX,
    );
    assert.equal(refreshed.length, 1, "mode=ro should see WAL-only refresh");
    assert.equal(refreshed[0].value, "refreshed-token", "should return refreshed token");
  } finally {
    await writer.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test(".backup snapshot captures WAL changes consistently", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), TEST_PREFIX));
  const dbPath = join(tempDir, "cookies.sqlite");
  const writer = openWalWriter(dbPath);

  try {
    await writer.write("INSERT INTO moz_cookies (name, value, host) VALUES ('AUTH-multi1', 'token-1', 'lumo.proton.me')");
    await writer.write("INSERT INTO moz_cookies (name, value, host) VALUES ('AUTH-multi2', 'token-2', 'lumo.proton.me')");
    await writer.write("UPDATE moz_cookies SET value='token-1-updated' WHERE name='AUTH-multi1'");

    // Take a backup while the writer is open — all three WAL-resident
    // transactions must appear together in one coherent snapshot.
    const snapshotPath = join(tempDir, "snapshot.sqlite");
    execSync(`sqlite3 "${dbPath}" ".backup '${snapshotPath}'"`, { encoding: "utf8" });

    const snapshotOutput = execSync(
      `sqlite3 -json "${snapshotPath}" "SELECT name, value FROM moz_cookies WHERE name LIKE 'AUTH-multi%' ORDER BY name"`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const rows = JSON.parse(snapshotOutput) as Array<{ name: string; value: string }>;
    assert.equal(rows.length, 2, "snapshot should have both AUTH cookies");

    const multi1 = rows.find((r) => r.name === "AUTH-multi1");
    const multi2 = rows.find((r) => r.name === "AUTH-multi2");
    assert.equal(multi1?.value, "token-1-updated", "snapshot should reflect updated value");
    assert.equal(multi2?.value, "token-2", "snapshot should reflect inserted value");
  } finally {
    await writer.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("querySqliteRows handles empty results gracefully", () => {
  const tempDir = mkdtempSync(join(tmpdir(), TEST_PREFIX));
  const dbPath = join(tempDir, "cookies.sqlite");

  try {
    execSync(`sqlite3 "${dbPath}" "CREATE TABLE moz_cookies (name TEXT, value TEXT)"`, {
      encoding: "utf8",
    });

    const result = querySqliteRows<{ name: string; value: string }>(
      dbPath,
      "SELECT name, value FROM moz_cookies WHERE name='NONEXISTENT'",
      TEST_PREFIX,
    );
    assert.deepEqual(result, [], "empty query should return empty array");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("fallback snapshot quotes paths with spaces and apostrophes", () => {
  // The database directory contains '#', which terminates the file: URI
  // (fragment marker) and makes the mode=ro primary read fail, forcing
  // the .backup fallback. The snapshot prefix carries a space and an
  // apostrophe, so the snapshot directory the fallback creates (via
  // mkdtempSync) exercises the dot-command argument quoting that is the
  // subject of this regression test.
  const tempDir = mkdtempSync(join(tmpdir(), TEST_PREFIX));
  const dbDirectory = join(tempDir, "profile #default");
  mkdirSync(dbDirectory);
  const dbPath = join(dbDirectory, "cookies.sqlite");
  execSync(
    `sqlite3 "${dbPath}" "CREATE TABLE moz_cookies (name TEXT, value TEXT, host TEXT); INSERT INTO moz_cookies VALUES ('AUTH-esc', 'escaped-token', 'lumo.proton.me');"`,
    { encoding: "utf8" },
  );

  // The prefix makes the fallback's snapshot directory inherit both a
  // space and an apostrophe (mkdtempSync appends random characters).
  const snapshotPrefix = `${TEST_PREFIX}O'Brien's `;

  try {
    const rows = querySqliteRows<{ name: string; value: string }>(
      dbPath,
      "SELECT name, value FROM moz_cookies WHERE name='AUTH-esc'",
      snapshotPrefix,
    );
    assert.equal(rows.length, 1, "fallback should succeed with space/apostrophe in snapshot path");
    assert.equal(rows[0].value, "escaped-token", "fallback should return the queried row");

    // The fallback must clean up its temporary snapshot directory.
    const leftovers = readdirSync(tmpdir()).filter((entry) => entry.startsWith(snapshotPrefix));
    assert.deepEqual(leftovers, [], "snapshot directory should be removed after the fallback");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

/**
 * Reads rows from a browser's cookie database via the `sqlite3` CLI.
 *
 * Browsers hold an exclusive lock on their cookie database while running.
 * The primary read opens the database read-only (`mode=ro`), which follows
 * the WAL and therefore sees committed transactions even while a writer is
 * active. `immutable=1` is deliberately avoided: it skips locking entirely
 * and can silently return stale results that ignore committed WAL frames.
 * When the read-only open fails (locked, busy, or incompatible), this
 * falls back to a consistent snapshot taken with SQLite's backup API
 * (`sqlite3 ... .backup`), which produces a single coherent copy of the
 * database including WAL contents, then deletes it immediately.
 */
export function querySqliteRows<T>(databasePath: string, query: string, snapshotPrefix: string): T[] {
  const run = (args: string[]): T[] => {
    const output = execFileSync("sqlite3", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15_000,
    });
    return output.trim() ? (JSON.parse(output) as T[]) : [];
  };

  const runQuery = (target: string, extra: string[] = []): T[] =>
    run(["-json", ...extra, target, query]);

  try {
    // Read-only open: honors WAL and sees committed transactions, unlike
    // immutable=1 which can serve stale main-file pages.
    return runQuery(`file:${databasePath}?mode=ro`);
  } catch {
    const snapshotDirectory = mkdtempSync(join(tmpdir(), snapshotPrefix));
    chmodSync(snapshotDirectory, 0o700);
    const snapshotPath = join(snapshotDirectory, basename(databasePath));
    try {
      // .backup uses SQLite's backup API under the hood, producing a
      // consistent snapshot atomically (main file + WAL together) rather
      // than copying them as separate, potentially mismatched generations.
      execFileSync("sqlite3", [databasePath, `.backup '${snapshotPath.replaceAll("'", "''")}'`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 15_000,
      });
      if (!existsSync(snapshotPath)) throw new Error("snapshot was not created");
      chmodSync(snapshotPath, 0o600);
      return runQuery(snapshotPath);
    } finally {
      rmSync(snapshotDirectory, { recursive: true, force: true });
    }
  }
}

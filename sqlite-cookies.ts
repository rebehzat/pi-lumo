import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

/**
 * Reads rows from a browser's cookie database via the `sqlite3` CLI.
 *
 * Browsers hold an exclusive lock on their cookie database while running.
 * When the direct read-only open fails, this falls back to copying the
 * database into a permission-restricted temporary file and querying that
 * snapshot instead, then deletes it immediately.
 */
export function querySqliteRows<T>(databasePath: string, query: string, snapshotPrefix: string): T[] {
  const run = (path: string): T[] => {
    const output = execFileSync("sqlite3", ["-json", path, query], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    });
    return output.trim() ? (JSON.parse(output) as T[]) : [];
  };

  try {
    return run(`file:${databasePath}?immutable=1`);
  } catch {
    const snapshotDirectory = mkdtempSync(join(tmpdir(), snapshotPrefix));
    chmodSync(snapshotDirectory, 0o700);
    const snapshotPath = join(snapshotDirectory, basename(databasePath));
    try {
      copyFileSync(databasePath, snapshotPath);
      chmodSync(snapshotPath, 0o600);
      return run(snapshotPath);
    } finally {
      rmSync(snapshotDirectory, { recursive: true, force: true });
    }
  }
}

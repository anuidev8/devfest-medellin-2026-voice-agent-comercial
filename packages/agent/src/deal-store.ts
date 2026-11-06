import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Saved leads, one JSON file on the agent server's disk. Keep the two exports
 * when moving to a real database. Don't run several server instances on this.
 */
const FILE = process.env.DEALS_FILE ?? resolve(dirname(fileURLToPath(import.meta.url)), "../data/deals.json");

export type Deal = Record<string, unknown> & { id: string; createdAt: string; updatedAt: string };

export function readDeals(): Record<string, Deal> {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as Record<string, Deal>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export function updateDeal(id: string, patch: Record<string, unknown>): Deal {
  const deals = readDeals();
  const now = new Date().toISOString();
  const deal: Deal = { ...deals[id], ...patch, id, createdAt: deals[id]?.createdAt ?? now, updatedAt: now };
  mkdirSync(dirname(FILE), { recursive: true });
  // Rename is atomic, so a crash mid-write can't corrupt the saved leads.
  writeFileSync(`${FILE}.tmp`, JSON.stringify({ ...deals, [id]: deal }, null, 2));
  renameSync(`${FILE}.tmp`, FILE);
  return deal;
}

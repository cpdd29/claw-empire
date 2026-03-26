/**
 * Memory Purge Scheduler
 * 每天凌晨 2:00 自动对所有秘书的记忆文件做提纯
 */
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { hasMemoryFile, purgeMemoryContent, readMemoryFile, writeMemoryFile } from "./memory-store.ts";

async function runPurgeAll(db: DatabaseSync): Promise<void> {
  let secretaries: { id: string; name: string }[];
  try {
    secretaries = db
      .prepare(
        `SELECT DISTINCT a.id, a.name
         FROM agents a
         INNER JOIN org_nodes n ON a.id = n.agent_id
         WHERE n.tier = 1`,
      )
      .all() as { id: string; name: string }[];
  } catch (err) {
    console.error("[memory-purge] Failed to query secretaries:", err);
    return;
  }

  let purgedCount = 0;
  for (const agent of secretaries) {
    if (!hasMemoryFile(agent.id)) continue;
    try {
      const original = readMemoryFile(agent.id);
      const purged = purgeMemoryContent(original);
      if (purged === original) continue;
      writeMemoryFile(agent.id, purged);
      const logId = `mlog-${Date.now()}-${randomUUID().slice(0, 6)}`;
      db.prepare(
        "INSERT INTO memory_logs (id, agent_id, content, type, created_at) VALUES (?, ?, ?, 'purge', ?)",
      ).run(logId, agent.id, `自动提纯：${original.length} → ${purged.length} 字符`, Date.now());
      purgedCount += 1;
    } catch (err) {
      console.error(`[memory-purge] Failed for agent ${agent.id}:`, err);
    }
  }

  console.log(`[memory-purge] Done: purged ${purgedCount}/${secretaries.length} memory files`);
}

function msUntilNext2AM(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(2, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function scheduleMemoryPurge({ db }: { db: DatabaseSync }): void {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const scheduleNext = () => {
    const delay = msUntilNext2AM();
    console.log(`[memory-purge] Next purge scheduled in ${Math.round(delay / 60000)} minutes`);
    setTimeout(() => {
      void runPurgeAll(db);
      setInterval(() => void runPurgeAll(db), MS_PER_DAY);
    }, delay);
  };

  scheduleNext();
}

/**
 * Memory Purge Scheduler
 * 每天凌晨 2:00 自动对所有秘书的记忆文件做提纯
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORIES_DIR = resolve(__dirname, "../../memories");

function memoryFilePath(agentId: string): string {
  return resolve(MEMORIES_DIR, `${agentId}.md`);
}

function ensureMemoriesDir() {
  if (!existsSync(MEMORIES_DIR)) mkdirSync(MEMORIES_DIR, { recursive: true });
}

/**
 * 简单本地提纯：去掉空行连续超过2行、去重相同条目
 * 生产环境可替换为 LLM 调用
 */
function purgeMemoryContent(content: string): string {
  const lines = content.split("\n");
  const seen = new Set<string>();
  const result: string[] = [];
  let emptyCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // 保留标题行
    if (trimmed.startsWith("##")) {
      seen.clear(); // 新区块重置去重
      result.push(line);
      emptyCount = 0;
      continue;
    }
    // 合并连续空行
    if (trimmed === "") {
      emptyCount++;
      if (emptyCount <= 1) result.push(line);
      continue;
    }
    emptyCount = 0;
    // 去重相同条目行
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(line);
  }

  return result.join("\n").trimEnd() + "\n";
}

async function runPurgeAll(db: DatabaseSync): Promise<void> {
  ensureMemoriesDir();

  let secretaries: { id: string; name: string }[];
  try {
    secretaries = db
      .prepare(
        `SELECT a.id, a.name FROM agents a
         INNER JOIN org_nodes n ON a.id = n.agent_id
         WHERE n.tier = 1`
      )
      .all() as { id: string; name: string }[];
  } catch (err) {
    console.error("[memory-purge] Failed to query secretaries:", err);
    return;
  }

  let purgedCount = 0;
  for (const agent of secretaries) {
    const filePath = memoryFilePath(agent.id);
    if (!existsSync(filePath)) continue;
    try {
      const original = readFileSync(filePath, "utf-8");
      const purged = purgeMemoryContent(original);
      if (purged === original) continue;
      writeFileSync(filePath, purged, "utf-8");
      const logId = `mlog-${Date.now()}-${randomUUID().slice(0, 6)}`;
      db.prepare(
        "INSERT INTO memory_logs (id, agent_id, content, type, created_at) VALUES (?, ?, ?, 'purge', ?)"
      ).run(logId, agent.id, `自动提纯：${original.length} → ${purged.length} 字符`, Date.now());
      purgedCount++;
    } catch (err) {
      console.error(`[memory-purge] Failed for agent ${agent.id}:`, err);
    }
  }

  console.log(`[memory-purge] Done: purged ${purgedCount}/${secretaries.length} memory files`);
}

/**
 * 计算距离下一个凌晨 2:00 的毫秒数
 */
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
      // 之后每 24 小时执行一次
      setInterval(() => void runPurgeAll(db), MS_PER_DAY);
    }, delay);
  };

  scheduleNext();
}

import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RuntimeContext } from "../../../types/runtime-context.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORIES_DIR = resolve(__dirname, "../../../../memories");

function ensureMemoriesDir() {
  if (!existsSync(MEMORIES_DIR)) mkdirSync(MEMORIES_DIR, { recursive: true });
}

function memoryFilePath(agentId: string): string {
  return resolve(MEMORIES_DIR, `${agentId}.md`);
}

function readMemoryFile(agentId: string): string {
  const path = memoryFilePath(agentId);
  if (!existsSync(path)) {
    return `## 用户信息\n\n（暂无）\n\n## 对话摘要\n\n（暂无）\n\n## 关键偏好\n\n（暂无）\n`;
  }
  return readFileSync(path, "utf-8");
}

function writeMemoryFile(agentId: string, content: string): void {
  ensureMemoriesDir();
  writeFileSync(memoryFilePath(agentId), content, "utf-8");
}

export function registerMemoryRoutes(ctx: RuntimeContext): void {
  const { app, db } = ctx;

  // GET /api/memories/:agentId — 读取记忆文件
  app.get("/api/memories/:agentId", (req, res) => {
    const { agentId } = req.params as { agentId: string };
    try {
      const content = readMemoryFile(agentId);
      const logs = db
        .prepare(
          "SELECT id, content, type, created_at FROM memory_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT 50"
        )
        .all(agentId) as { id: string; content: string; type: string; created_at: number }[];
      res.json({ ok: true, content, logs });
    } catch (err) {
      console.error("[memories] GET failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // PUT /api/memories/:agentId — 保存记忆文件（全量替换）
  app.put("/api/memories/:agentId", (req, res) => {
    const { agentId } = req.params as { agentId: string };
    const { content } = req.body as { content: string };
    if (typeof content !== "string") {
      res.status(400).json({ error: "content required" });
      return;
    }
    try {
      writeMemoryFile(agentId, content);
      const logId = `mlog-${Date.now()}-${randomUUID().slice(0, 6)}`;
      db.prepare(
        "INSERT INTO memory_logs (id, agent_id, content, type, created_at) VALUES (?, ?, ?, 'add', ?)"
      ).run(logId, agentId, content.slice(0, 500), Date.now());
      res.json({ ok: true });
    } catch (err) {
      console.error("[memories] PUT failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/memories/:agentId/append — 追加一条记忆
  app.post("/api/memories/:agentId/append", (req, res) => {
    const { agentId } = req.params as { agentId: string };
    const { content, section } = req.body as { content: string; section?: string };
    if (!content?.trim()) {
      res.status(400).json({ error: "content required" });
      return;
    }
    try {
      const existing = readMemoryFile(agentId);
      const target = section ?? "## 对话摘要";
      const entry = `- ${new Date().toISOString().slice(0, 10)}: ${content.trim()}`;
      let updated: string;
      if (existing.includes(target)) {
        updated = existing.replace(target, `${target}\n${entry}`);
      } else {
        updated = existing + `\n${entry}\n`;
      }
      writeMemoryFile(agentId, updated);
      const logId = `mlog-${Date.now()}-${randomUUID().slice(0, 6)}`;
      db.prepare(
        "INSERT INTO memory_logs (id, agent_id, content, type, created_at) VALUES (?, ?, ?, 'add', ?)"
      ).run(logId, agentId, content.slice(0, 500), Date.now());
      res.json({ ok: true, content: updated });
    } catch (err) {
      console.error("[memories] append failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/memories — 列出所有有记忆文件的秘书（tier=1）
  app.get("/api/memories", (_req, res) => {
    try {
      const secretaries = db
        .prepare(
          `SELECT a.id, a.name, a.avatar_emoji, a.department_id
           FROM agents a
           INNER JOIN org_nodes n ON a.id = n.agent_id
           WHERE n.tier = 1
           ORDER BY a.name`
        )
        .all() as { id: string; name: string; avatar_emoji: string; department_id: string }[];
      const result = secretaries.map((s) => ({
        ...s,
        has_memory: existsSync(memoryFilePath(s.id)),
      }));
      res.json({ ok: true, secretaries: result });
    } catch (err) {
      console.error("[memories] list failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}

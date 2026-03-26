import type { RuntimeContext } from "../../../types/runtime-context.ts";
import type { AgentRow } from "../shared/types.ts";
import {
  MEMORY_SECTIONS,
  appendMemorySectionEntries,
  createMemoryLogId,
  getMemoryUpdatedAt,
  hasMemoryFile,
  normalizeMemoryContent,
  readMemoryFile,
  stripMarkdownCodeFence,
  writeMemoryFile,
} from "../../memory-store.ts";

function insertMemoryLog(
  db: RuntimeContext["db"],
  agentId: string,
  type: "add" | "purge",
  content: string,
  createdAt: number,
): void {
  db.prepare("INSERT INTO memory_logs (id, agent_id, content, type, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(createMemoryLogId(), agentId, content.slice(0, 500), type, createdAt);
}

function isTierOneSecretary(db: RuntimeContext["db"], agentId: string): boolean {
  try {
    const row = db.prepare("SELECT 1 AS ok FROM org_nodes WHERE agent_id = ? AND tier = 1 LIMIT 1").get(agentId) as
      | { ok: number }
      | undefined;
    return Boolean(row?.ok);
  } catch {
    return false;
  }
}

function loadSecretaryAgent(db: RuntimeContext["db"], agentId: string): AgentRow | null {
  if (!isTierOneSecretary(db, agentId)) return null;
  const agent = db
    .prepare(
      `
        SELECT
          id,
          name,
          COALESCE(name_ko, name) AS name_ko,
          role,
          personality,
          status,
          department_id,
          current_task_id,
          avatar_emoji,
          cli_provider,
          oauth_account_id,
          api_provider_id,
          api_model,
          cli_model,
          cli_reasoning_level
        FROM agents
        WHERE id = ?
      `,
    )
    .get(agentId) as AgentRow | undefined;
  return agent ?? null;
}

function buildPurifyPrompt(content: string): string {
  return [
    "[Secretary Memory Purifier]",
    "请将下面的秘书长期记忆提纯为更短、更稳态、更可复用的版本。",
    "输出必须满足以下要求：",
    `1. 严格保持这四个标题及顺序：${MEMORY_SECTIONS.join(" / ")}`,
    "2. 每个标题下仅保留长期有效、可复用的信息，删除临时执行噪音、重复内容、寒暄、流水账。",
    "3. 使用简洁项目符号；没有内容时写（暂无）。",
    "4. 只输出最终 Markdown，不要解释，不要代码块。",
    "",
    "[当前记忆]",
    content,
  ].join("\n");
}

function isUsablePurifiedMemory(content: string): boolean {
  const normalized = normalizeMemoryContent(stripMarkdownCodeFence(content));
  return MEMORY_SECTIONS.every((section) => normalized.includes(section));
}

export function registerMemoryRoutes(ctx: RuntimeContext): void {
  const { app, db, runAgentOneShot } = ctx;

  app.get("/api/memories/:agentId", (req, res) => {
    const { agentId } = req.params as { agentId: string };
    try {
      const content = readMemoryFile(agentId);
      const logs = db
        .prepare(
          "SELECT id, content, type, created_at FROM memory_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT 50",
        )
        .all(agentId) as { id: string; content: string; type: string; created_at: number }[];
      res.json({ ok: true, content, logs, updated_at: getMemoryUpdatedAt(agentId) });
    } catch (err) {
      console.error("[memories] GET failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.put("/api/memories/:agentId", (req, res) => {
    const { agentId } = req.params as { agentId: string };
    const { content } = req.body as { content: string };
    if (typeof content !== "string") {
      res.status(400).json({ error: "content required" });
      return;
    }
    try {
      const updatedAt = writeMemoryFile(agentId, content);
      insertMemoryLog(db, agentId, "add", "手动保存记忆内容", Date.now());
      res.json({ ok: true, updated_at: updatedAt });
    } catch (err) {
      console.error("[memories] PUT failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.post("/api/memories/:agentId/append", (req, res) => {
    const { agentId } = req.params as { agentId: string };
    const { content, section } = req.body as { content: string; section?: string };
    const normalizedContent = String(content || "").trim();
    if (!normalizedContent) {
      res.status(400).json({ error: "content required" });
      return;
    }
    try {
      const targetSection = MEMORY_SECTIONS.includes(section as (typeof MEMORY_SECTIONS)[number])
        ? (section as (typeof MEMORY_SECTIONS)[number])
        : "## 对话摘要";
      const existing = readMemoryFile(agentId);
      const updated = appendMemorySectionEntries(existing, targetSection, [normalizedContent], Date.now());
      const updatedAt = writeMemoryFile(agentId, updated);
      insertMemoryLog(db, agentId, "add", normalizedContent, Date.now());
      res.json({ ok: true, content: updated, updated_at: updatedAt });
    } catch (err) {
      console.error("[memories] append failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.post("/api/memories/:agentId/purify", async (req, res) => {
    const { agentId } = req.params as { agentId: string };
    try {
      const agent = loadSecretaryAgent(db, agentId);
      if (!agent) {
        res.status(404).json({ error: "secretary_not_found" });
        return;
      }

      const beforeContent = readMemoryFile(agentId);
      const run = await runAgentOneShot(agent, buildPurifyPrompt(beforeContent), {
        projectPath: process.cwd(),
        timeoutMs: 120_000,
        rawOutput: true,
        noTools: true,
      });
      const afterContent = normalizeMemoryContent(stripMarkdownCodeFence(run.text || ""));
      if (!isUsablePurifiedMemory(afterContent)) {
        res.status(502).json({ error: "purify_failed" });
        return;
      }

      const updatedAt = writeMemoryFile(agentId, afterContent);
      insertMemoryLog(db, agentId, "purge", `手动提纯：${beforeContent.length} → ${afterContent.length} 字符`, Date.now());
      const logs = db
        .prepare(
          "SELECT id, content, type, created_at FROM memory_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT 50",
        )
        .all(agentId) as { id: string; content: string; type: string; created_at: number }[];
      res.json({
        ok: true,
        before_content: beforeContent,
        content: afterContent,
        method: "llm",
        updated_at: updatedAt,
        logs,
      });
    } catch (err) {
      console.error("[memories] purify failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.get("/api/memories", (_req, res) => {
    try {
      const secretaries = db
        .prepare(
          `SELECT a.id, a.name, a.avatar_emoji, a.department_id
           FROM agents a
           INNER JOIN org_nodes n ON a.id = n.agent_id
           WHERE n.tier = 1
           ORDER BY a.name`,
        )
        .all() as { id: string; name: string; avatar_emoji: string; department_id: string }[];
      res.json({
        ok: true,
        secretaries: secretaries.map((secretary) => ({
          ...secretary,
          has_memory: hasMemoryFile(secretary.id),
          updated_at: getMemoryUpdatedAt(secretary.id),
        })),
      });
    } catch (err) {
      console.error("[memories] list failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}

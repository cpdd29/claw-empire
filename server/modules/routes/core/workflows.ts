import { randomUUID } from "node:crypto";
import type { RuntimeContext } from "../../../types/runtime-context.ts";

interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  nodes_json: string | null;
  edges_json: string | null;
  status: string;
  assigned_agent_id: string | null;
  run_count: number;
  created_at: number;
  updated_at: number;
}

export function registerWorkflowRoutes(ctx: RuntimeContext): void {
  const { app, db } = ctx;

  // GET /api/workflows — 获取所有工作流列表
  app.get("/api/workflows", (_req, res) => {
    try {
      const rows = db
        .prepare(
          "SELECT id, name, description, status, assigned_agent_id, run_count, created_at, updated_at FROM workflows ORDER BY updated_at DESC"
        )
        .all() as WorkflowRow[];
      res.json({ ok: true, workflows: rows });
    } catch (err) {
      console.error("[workflows] GET list failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/workflows/:id — 获取单个工作流详情
  app.get("/api/workflows/:id", (req, res) => {
    const { id } = req.params as { id: string };
    try {
      const row = db
        .prepare("SELECT * FROM workflows WHERE id = ?")
        .get(id) as WorkflowRow | undefined;
      if (!row) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ ok: true, workflow: row });
    } catch (err) {
      console.error("[workflows] GET detail failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/workflows — 创建工作流
  app.post("/api/workflows", (req, res) => {
    const { name, description, nodes_json, edges_json, status, assigned_agent_id } = req.body as {
      name: string;
      description?: string;
      nodes_json?: string;
      edges_json?: string;
      status?: string;
      assigned_agent_id?: string;
    };
    if (!name?.trim()) {
      res.status(400).json({ error: "name required" });
      return;
    }
    if (assigned_agent_id) {
      const conflict = db
        .prepare("SELECT id FROM workflows WHERE assigned_agent_id = ? LIMIT 1")
        .get(assigned_agent_id);
      if (conflict) {
        res.status(400).json({ error: "该负责人已绑定其他工作流" });
        return;
      }
    }
    const id = randomUUID();
    const now = Date.now();
    try {
      db.prepare(
        `INSERT INTO workflows (id, name, description, nodes_json, edges_json, status, assigned_agent_id, run_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      ).run(
        id,
        name.trim(),
        description ?? null,
        nodes_json ?? null,
        edges_json ?? null,
        status ?? "draft",
        assigned_agent_id ?? null,
        now,
        now,
      );
      const created = db.prepare("SELECT * FROM workflows WHERE id = ?").get(id) as WorkflowRow;
      res.status(201).json({ ok: true, workflow: created });
    } catch (err) {
      console.error("[workflows] POST failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // PATCH /api/workflows/:id — 更新工作流
  app.patch("/api/workflows/:id", (req, res) => {
    const { id } = req.params as { id: string };
    const existing = db
      .prepare("SELECT * FROM workflows WHERE id = ?")
      .get(id) as WorkflowRow | undefined;
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const body = req.body as Partial<{
      name: string;
      description: string;
      nodes_json: string;
      edges_json: string;
      status: string;
      assigned_agent_id: string | null;
    }>;
    const name = body.name !== undefined ? body.name : existing.name;
    const description = body.description !== undefined ? body.description : existing.description;
    const nodes_json = body.nodes_json !== undefined ? body.nodes_json : existing.nodes_json;
    const edges_json = body.edges_json !== undefined ? body.edges_json : existing.edges_json;
    const status = body.status !== undefined ? body.status : existing.status;
    const assigned_agent_id = body.assigned_agent_id !== undefined ? body.assigned_agent_id : existing.assigned_agent_id;
    if (assigned_agent_id && assigned_agent_id !== existing.assigned_agent_id) {
      const conflict = db
        .prepare("SELECT id FROM workflows WHERE assigned_agent_id = ? AND id != ? LIMIT 1")
        .get(assigned_agent_id, id);
      if (conflict) {
        res.status(400).json({ error: "该负责人已绑定其他工作流" });
        return;
      }
    }
    try {
      db.prepare(
        `UPDATE workflows SET name=?, description=?, nodes_json=?, edges_json=?, status=?, assigned_agent_id=?, updated_at=? WHERE id=?`
      ).run(name, description, nodes_json, edges_json, status, assigned_agent_id, Date.now(), id);
      const updated = db.prepare("SELECT * FROM workflows WHERE id = ?").get(id) as WorkflowRow;
      res.json({ ok: true, workflow: updated });
    } catch (err) {
      console.error("[workflows] PATCH failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // DELETE /api/workflows/:id — 删除工作流
  app.delete("/api/workflows/:id", (req, res) => {
    const { id } = req.params as { id: string };
    try {
      const existing = db
        .prepare("SELECT id FROM workflows WHERE id = ?")
        .get(id);
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      db.prepare("DELETE FROM workflows WHERE id = ?").run(id);
      res.json({ ok: true });
    } catch (err) {
      console.error("[workflows] DELETE failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}

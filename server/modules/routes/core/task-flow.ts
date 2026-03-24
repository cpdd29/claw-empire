/**
 * Task Flow API Routes
 * 
 * Provides task delegation flow tracking across org nodes (infinite nesting CEO structure)
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";

interface TaskFlowLogRow {
  id: string;
  task_id: string;
  from_node_id: string | null;
  to_node_id: string | null;
  instructions: string | null;
  status: string | null;
  summary: string | null;
  created_at: number;
}

interface TaskFlowLogInput {
  task_id: string;
  from_node_id?: string | null;
  to_node_id?: string | null;
  instructions?: string | null;
  status?: string | null;
  summary?: string | null;
}

function asTaskFlowLogRow(raw: unknown): TaskFlowLogRow {
  return raw as TaskFlowLogRow;
}

function asTaskFlowLogRows(raw: unknown): TaskFlowLogRow[] {
  return raw as TaskFlowLogRow[];
}

export function registerTaskFlowRoutes(ctx: RuntimeContext): void {
  const { app, db, normalizeTextField, broadcast } = ctx;

  // ---------------------------------------------------------------------------
  // POST /api/task-flow/delegate
  // Delegate a task from one org node to another
  // ---------------------------------------------------------------------------
  app.post("/api/task-flow/delegate", (req, res) => {
    try {
      const body = req.body as {
        task_id: string;
        from_node_id?: string;
        to_node_id: string;
        instructions?: string;
      };

      if (!body.task_id) {
        return res.status(400).json({ ok: false, error: "task_id_required" });
      }
      if (!body.to_node_id) {
        return res.status(400).json({ ok: false, error: "to_node_id_required" });
      }

      // Verify task exists
      const task = db.prepare("SELECT id, title FROM tasks WHERE id = ?").get(body.task_id);
      if (!task) {
        return res.status(404).json({ ok: false, error: "task_not_found" });
      }

      // Verify to_node exists
      const toNode = db.prepare("SELECT id, name FROM org_nodes WHERE id = ?").get(body.to_node_id);
      if (!toNode) {
        return res.status(404).json({ ok: false, error: "to_node_not_found" });
      }

      // Verify from_node exists (if provided)
      if (body.from_node_id) {
        const fromNode = db.prepare("SELECT id, name FROM org_nodes WHERE id = ?").get(body.from_node_id);
        if (!fromNode) {
          return res.status(404).json({ ok: false, error: "from_node_not_found" });
        }
      }

      const id = "tflow-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const now = Date.now();

      db.prepare(`
        INSERT INTO task_flow_logs (id, task_id, from_node_id, to_node_id, instructions, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        body.task_id,
        body.from_node_id || null,
        body.to_node_id,
        normalizeTextField(body.instructions) || null,
        "delegated",
        now
      );

      const log = asTaskFlowLogRow(db.prepare("SELECT * FROM task_flow_logs WHERE id = ?").get(id));

      res.status(201).json({ ok: true, log });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/task-flow/:task_id/chain
  // Get the complete delegation chain for a task
  // ---------------------------------------------------------------------------
  app.get("/api/task-flow/:task_id/chain", (req, res) => {
    try {
      const { task_id } = req.params;

      // Verify task exists
      const task = db.prepare("SELECT id, title FROM tasks WHERE id = ?").get(task_id);
      if (!task) {
        return res.status(404).json({ ok: false, error: "task_not_found" });
      }

      const logs = asTaskFlowLogRows(db.prepare(`
        SELECT tfl.*,
          fn.name as from_node_name,
          fn.tier as from_node_tier,
          tn.name as to_node_name,
          tn.tier as to_node_tier
        FROM task_flow_logs tfl
        LEFT JOIN org_nodes fn ON tfl.from_node_id = fn.id
        LEFT JOIN org_nodes tn ON tfl.to_node_id = tn.id
        WHERE tfl.task_id = ?
        ORDER BY tfl.created_at ASC
      `).all(task_id));

      // Build chain with enriched data
      const chain = logs.map(log => ({
        id: log.id,
        task_id: log.task_id,
        from_node_id: log.from_node_id,
        from_node_name: (log as any).from_node_name || null,
        from_node_tier: (log as any).from_node_tier ?? null,
        to_node_id: log.to_node_id,
        to_node_name: (log as any).to_node_name || null,
        to_node_tier: (log as any).to_node_tier ?? null,
        node_id: log.to_node_id,
        node_name: (log as any).to_node_name || null,
        node_tier: (log as any).to_node_tier ?? null,
        instructions: log.instructions,
        status: log.status,
        summary: log.summary,
        created_at: log.created_at
      }));

      res.json({ ok: true, chain });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/task-flow/report
  // Subordinate reports progress/status to superior
  // ---------------------------------------------------------------------------
  app.post("/api/task-flow/report", (req, res) => {
    try {
      const body = req.body as {
        task_id: string;
        from_node_id?: string;
        to_node_id?: string;
        status?: string;
        summary: string;
      };

      if (!body.task_id) {
        return res.status(400).json({ ok: false, error: "task_id_required" });
      }

      // Verify task exists
      const task = db.prepare("SELECT id, title FROM tasks WHERE id = ?").get(body.task_id);
      if (!task) {
        return res.status(404).json({ ok: false, error: "task_not_found" });
      }

      // Verify from_node exists (if provided)
      if (body.from_node_id) {
        const fromNode = db.prepare("SELECT id, name FROM org_nodes WHERE id = ?").get(body.from_node_id);
        if (!fromNode) {
          return res.status(404).json({ ok: false, error: "from_node_not_found" });
        }
      }

      // Verify to_node exists (if provided)
      if (body.to_node_id) {
        const toNode = db.prepare("SELECT id, name FROM org_nodes WHERE id = ?").get(body.to_node_id);
        if (!toNode) {
          return res.status(404).json({ ok: false, error: "to_node_not_found" });
        }
      }

      const id = "tflow-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const now = Date.now();

      // Validate status if provided
      const validStatuses = ["pending", "in_progress", "completed", "failed", "blocked", "reported"];
      const status = body.status && validStatuses.includes(body.status) ? body.status : "reported";

      db.prepare(`
        INSERT INTO task_flow_logs (id, task_id, from_node_id, to_node_id, status, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        body.task_id,
        body.from_node_id || null,
        body.to_node_id || null,
        status,
        normalizeTextField(body.summary) || null,
        now
      );

      const log = asTaskFlowLogRow(db.prepare("SELECT * FROM task_flow_logs WHERE id = ?").get(id));

      res.status(201).json({ ok: true, log });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/task-flow/:task_id/history
  // Get all task flow logs for a task (alternative view)
  // ---------------------------------------------------------------------------
  app.get("/api/task-flow/:task_id/history", (req, res) => {
    try {
      const { task_id } = req.params;

      const logs = asTaskFlowLogRows(db.prepare(`
        SELECT tfl.*,
          fn.name as from_node_name,
          tn.name as to_node_name
        FROM task_flow_logs tfl
        LEFT JOIN org_nodes fn ON tfl.from_node_id = fn.id
        LEFT JOIN org_nodes tn ON tfl.to_node_id = tn.id
        WHERE tfl.task_id = ?
        ORDER BY tfl.created_at DESC
      `).all(task_id));

      res.json({ ok: true, logs });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });
}

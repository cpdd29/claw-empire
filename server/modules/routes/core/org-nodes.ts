/**
 * Org Nodes API Routes
 * 
 * Provides CRUD operations for hierarchical org nodes (infinite nesting CEO structure)
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { syncOrganizationRelationMappings } from "../../organization/relationship-mappings.ts";

interface OrgNodeInput {
  name: string;
  name_ko?: string;
  name_ja?: string;
  name_zh?: string;
  tier: number;
  parent_id?: string | null;
  department_id?: string | null;
  agent_id?: string | null;
  metadata_json?: string;
  sort_order?: number;
}

interface OrgNodeRow {
  id: string;
  name: string;
  name_ko: string;
  name_ja: string;
  name_zh: string;
  tier: number;
  parent_id: string | null;
  department_id: string | null;
  agent_id: string | null;
  metadata_json: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

function asOrgNodeRow(raw: unknown): OrgNodeRow {
  return raw as OrgNodeRow;
}

function asOrgNodeRows(raw: unknown): OrgNodeRow[] {
  return raw as OrgNodeRow[];
}

export function registerOrgNodeRoutes(ctx: RuntimeContext): void {
  const { app, db, normalizeTextField, broadcast } = ctx;

  // ---------------------------------------------------------------------------
  // List all org nodes (tree structure)
  // ---------------------------------------------------------------------------
  app.get("/api/org-nodes", (_req, res) => {
    try {
      const nodes = asOrgNodeRows(db.prepare(`
        SELECT * FROM org_nodes ORDER BY tier ASC, sort_order ASC, name ASC
      `).all());
      res.json({ ok: true, nodes });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // Get org node by ID with children
  // ---------------------------------------------------------------------------
  app.get("/api/org-nodes/:id", (req, res) => {
    try {
      const { id } = req.params;
      const node = asOrgNodeRow(db.prepare("SELECT * FROM org_nodes WHERE id = ?").get(id as string));

      if (!node) {
        return res.status(404).json({ ok: false, error: "org_node_not_found" });
      }

      const children = asOrgNodeRows(db.prepare(
        "SELECT * FROM org_nodes WHERE parent_id = ? ORDER BY sort_order ASC, name ASC"
      ).all(node.id));

      const ancestors: OrgNodeRow[] = [];
      let currentParentId = node.parent_id;
      while (currentParentId) {
        const parent = asOrgNodeRow(db.prepare("SELECT * FROM org_nodes WHERE id = ?").get(currentParentId as string));
        if (parent) {
          ancestors.unshift(parent);
          currentParentId = parent.parent_id;
        } else {
          break;
        }
      }

      res.json({ ok: true, node, children, ancestors });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // Create org node
  // ---------------------------------------------------------------------------
  app.post("/api/org-nodes", (req, res) => {
    try {
      const body = req.body as OrgNodeInput;
      const name = normalizeTextField(body.name);

      if (!name) {
        return res.status(400).json({ ok: false, error: "name_required" });
      }

      const tier = Number(body.tier) || 1;
      const parentId = body.parent_id || null;
      const departmentId = body.department_id || null;
      const agentId = body.agent_id || null;
      const sortOrder = Number(body.sort_order) || 99;
      const metadataJson = body.metadata_json || null;
      const nameKo = normalizeTextField(body.name_ko ?? body.name ?? "");
      const nameJa = normalizeTextField(body.name_ja ?? body.name ?? "");
      const nameZh = normalizeTextField(body.name_zh ?? body.name ?? "");

      if (parentId) {
        const parent = db.prepare("SELECT id, tier FROM org_nodes WHERE id = ?").get(parentId) as
          | { id: string; tier: number }
          | undefined;
        if (!parent) {
          return res.status(400).json({ ok: false, error: "parent_not_found" });
        }
        if (tier !== parent.tier + 1) {
          return res.status(400).json({
            ok: false,
            error: `tier_must_be_parent_plus_one: expected ${parent.tier + 1}, got ${tier}`,
          });
        }
      }

      // Validate agent_id if provided
      if (agentId) {
        const agent = db.prepare("SELECT id FROM agents WHERE id = ?").get(agentId);
        if (!agent) {
          return res.status(400).json({ ok: false, error: "agent_not_found" });
        }
      }

      const id = "org-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const now = Date.now();

      db.prepare(`
        INSERT INTO org_nodes (id, name, name_ko, name_ja, name_zh, tier, parent_id,
          department_id, agent_id, metadata_json, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, nameKo, nameJa, nameZh, tier, parentId, departmentId, agentId, metadataJson, sortOrder, now, now);

      // Link agent to this node if agent_id provided
      if (agentId) {
        db.prepare("UPDATE agents SET org_node_id = ? WHERE id = ?").run(id, agentId);
      }

      syncOrganizationRelationMappings(db as any);
      const node = asOrgNodeRow(db.prepare("SELECT * FROM org_nodes WHERE id = ?").get(id));
      broadcast({ type: "org_node_created", node });
      res.status(201).json({ ok: true, node });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // Update org node
  // ---------------------------------------------------------------------------
  app.patch("/api/org-nodes/:id", (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body as Partial<OrgNodeInput>;

      const existing = asOrgNodeRow(db.prepare("SELECT * FROM org_nodes WHERE id = ?").get(id));
      if (!existing) {
        return res.status(404).json({ ok: false, error: "org_node_not_found" });
      }

      const updates: string[] = [];
      const values: unknown[] = [];

      if (body.name !== undefined) {
        updates.push("name = ?");
        values.push(normalizeTextField(body.name));
      }
      if (body.name_ko !== undefined) {
        updates.push("name_ko = ?");
        values.push(normalizeTextField(body.name_ko));
      }
      if (body.name_ja !== undefined) {
        updates.push("name_ja = ?");
        values.push(normalizeTextField(body.name_ja));
      }
      if (body.name_zh !== undefined) {
        updates.push("name_zh = ?");
        values.push(normalizeTextField(body.name_zh));
      }
      if (body.sort_order !== undefined) {
        updates.push("sort_order = ?");
        values.push(Number(body.sort_order));
      }
      if (body.parent_id !== undefined) {
        updates.push("parent_id = ?");
        values.push(body.parent_id || null);
      }
      if (body.department_id !== undefined) {
        updates.push("department_id = ?");
        values.push(body.department_id || null);
      }
      if (body.metadata_json !== undefined) {
        updates.push("metadata_json = ?");
        values.push(body.metadata_json || null);
      }
      if (body.tier !== undefined) {
        updates.push("tier = ?");
        values.push(Number(body.tier));
      }
      if (body.agent_id !== undefined) {
        updates.push("agent_id = ?");
        values.push(body.agent_id || null);
        // Also update the agent's org_node_id link
        if (body.agent_id) {
          db.prepare("UPDATE agents SET org_node_id = ? WHERE id = ?").run(id, body.agent_id);
        } else {
          db.prepare("UPDATE agents SET org_node_id = NULL WHERE org_node_id = ?").run(id);
        }
      }

      if (updates.length === 0) {
        return res.json({ ok: true, node: existing });
      }

      updates.push("updated_at = ?");
      values.push(Date.now());
      values.push(id);

      db.prepare("UPDATE org_nodes SET " + updates.join(", ") + " WHERE id = ?").run(...values);

      syncOrganizationRelationMappings(db as any);
      const node = asOrgNodeRow(db.prepare("SELECT * FROM org_nodes WHERE id = ?").get(id));
      broadcast({ type: "org_node_updated", node });
      res.json({ ok: true, node });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // Delete org node
  // ---------------------------------------------------------------------------
  app.delete("/api/org-nodes/:id", (req, res) => {
    try {
      const { id } = req.params;

      if (id === "super-ceo-root") {
        return res.status(403).json({ ok: false, error: "cannot_delete_super_ceo_root" });
      }

      const childCount = db.prepare(
        "SELECT COUNT(*) as cnt FROM org_nodes WHERE parent_id = ?"
      ).get(id) as { cnt: number };

      if (childCount.cnt > 0) {
        return res.status(409).json({
          ok: false,
          error: "cannot_delete_node_with_children",
          child_count: childCount.cnt,
        });
      }

      db.prepare("UPDATE agents SET org_node_id = NULL WHERE org_node_id = ?").run(id);
      db.prepare("DELETE FROM org_nodes WHERE id = ?").run(id);
      syncOrganizationRelationMappings(db as any);
      broadcast({ type: "org_node_deleted", node_id: id });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // Get subtree (all descendants)
  // ---------------------------------------------------------------------------
  app.get("/api/org-nodes/:id/subtree", (req, res) => {
    try {
      const { id } = req.params;

      const subtree = asOrgNodeRows(db.prepare(`
        WITH RECURSIVE node_tree AS (
          SELECT * FROM org_nodes WHERE id = ?
          UNION ALL
          SELECT n.* FROM org_nodes n
          INNER JOIN node_tree nt ON n.parent_id = nt.id
        )
        SELECT * FROM node_tree ORDER BY tier ASC, sort_order ASC
      `).all(id as string));

      res.json({ ok: true, subtree });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // Get agents under an org node
  // ---------------------------------------------------------------------------
  app.get("/api/org-nodes/:id/agents", (req, res) => {
    try {
      const { id } = req.params;

      const agents = db.prepare(`
        SELECT a.* FROM agents a WHERE a.org_node_id = ? ORDER BY a.created_at DESC
      `).all(id);

      res.json({ ok: true, agents });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // Cross-node communication: send message to sibling nodes
  // ---------------------------------------------------------------------------
  app.post("/api/org-nodes/:id/siblings/message", (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body as { content: string; sender_agent_id?: string };
      const content = normalizeTextField(body.content);

      if (!content) {
        return res.status(400).json({ ok: false, error: "content_required" });
      }

      const node = asOrgNodeRow(db.prepare("SELECT * FROM org_nodes WHERE id = ?").get(id));
      if (!node) {
        return res.status(404).json({ ok: false, error: "org_node_not_found" });
      }

      const siblings = asOrgNodeRows(db.prepare(`
        SELECT * FROM org_nodes WHERE parent_id = ? AND id != ? ORDER BY sort_order ASC
      `).all(node.parent_id, id));

      if (siblings.length === 0) {
        return res.json({ ok: true, message: "no_siblings", sent: 0 });
      }

      let sentCount = 0;
      const now = Date.now();

      for (const sibling of siblings) {
        const agents = db.prepare("SELECT id FROM agents WHERE org_node_id = ?").all(sibling.id) as
          | { id: string }[]
          | undefined;
        if (!agents) continue;
        for (const agent of agents) {
          db.prepare(`
            INSERT INTO messages (id, sender_type, sender_id, receiver_type, receiver_id,
              content, message_type, org_sender_node_id, org_receiver_node_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            "msg-" + now + "-" + Math.random().toString(36).slice(2, 6),
            "agent",
            body.sender_agent_id || null,
            "agent",
            agent.id,
            content,
            "chat",
            id,
            sibling.id,
            now,
          );
          sentCount++;
        }
      }

      broadcast({
        type: "cross_node_message_sent",
        from_node_id: id,
        sibling_count: siblings.length,
        agent_count: sentCount,
      });

      res.json({ ok: true, sent_count: sentCount, sibling_count: siblings.length });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // Get peer nodes at same tier
  // ---------------------------------------------------------------------------
  app.get("/api/org-nodes/:id/peers", (req, res) => {
    try {
      const { id } = req.params;

      const node = asOrgNodeRow(db.prepare("SELECT * FROM org_nodes WHERE id = ?").get(id));
      if (!node) {
        return res.status(404).json({ ok: false, error: "org_node_not_found" });
      }

      const peers = asOrgNodeRows(db.prepare(`
        SELECT * FROM org_nodes WHERE tier = ? AND id != ? ORDER BY sort_order ASC, name ASC
      `).all(node.tier, id));

      res.json({ ok: true, peers });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // Get task flow chain for a task (org node delegation path)
  // ---------------------------------------------------------------------------
  app.get("/api/task-flow/:taskId/chain", (req, res) => {
    try {
      const { taskId } = req.params;

      // Get flow logs for this task
      interface FlowLogRow {
        id: string;
        task_id: string;
        from_node_id: string | null;
        to_node_id: string;
        instructions: string | null;
        status: string;
        created_at: number;
      }

      const flowLogs = (db.prepare(`
        SELECT tfl.* FROM task_flow_logs tfl
        WHERE tfl.task_id = ?
        ORDER BY tfl.created_at ASC
      `).all(taskId) as unknown) as FlowLogRow[];

      // Build chain with node names
      interface ChainNode {
        node_id: string;
        node_name: string;
        node_tier: number;
        from_node_id: string | null;
        to_node_id: string;
        instructions: string | null;
        status: string;
        created_at: number;
      }

      const chain: ChainNode[] = [];

      for (const log of flowLogs) {
        const toNode = asOrgNodeRow(db.prepare("SELECT * FROM org_nodes WHERE id = ?").get(log.to_node_id));
        if (toNode) {
          chain.push({
            node_id: toNode.id,
            node_name: toNode.name,
            node_tier: toNode.tier,
            from_node_id: log.from_node_id,
            to_node_id: log.to_node_id,
            instructions: log.instructions,
            status: log.status,
            created_at: log.created_at,
          });
        }
      }

      res.json({ ok: true, chain });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // Get active task count for an org node
  // ---------------------------------------------------------------------------
  app.get("/api/org-nodes/:id/active-tasks", (req, res) => {
    try {
      const { id } = req.params;

      // Count tasks where this node is the current handler and status is active
      const activeStatuses = ["planned", "in_progress", "collaborating", "pending"];

      const result = db.prepare(`
        SELECT COUNT(*) as cnt FROM tasks
        WHERE current_org_node_id = ?
          AND status IN (${activeStatuses.map(() => "?").join(",")})
      `).get(id, ...activeStatuses) as { cnt: number };

      res.json({
        ok: true,
        node_id: id,
        active_task_count: result.cnt,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });
}

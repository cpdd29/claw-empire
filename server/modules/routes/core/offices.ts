import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { randomUUID } from "node:crypto";
import { syncOrganizationRelationMappings } from "../../organization/relationship-mappings.ts";

export type OfficeRouteDeps = Pick<
  RuntimeContext,
  "app" | "db" | "broadcast" | "normalizeTextField" | "runInTransaction"
>;

export function registerOfficeRoutes(deps: OfficeRouteDeps): void {
  const { app, db, broadcast, normalizeTextField, runInTransaction } = deps;

  function parseMetadata(raw: unknown): Record<string, unknown> {
    if (typeof raw !== "string" || !raw.trim()) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  // GET /api/offices
  app.get("/api/offices", (_req, res) => {
    try {
      const offices = db
        .prepare("SELECT * FROM offices ORDER BY sort_order ASC, created_at ASC")
        .all();
      res.json({ offices });
    } catch (err) {
      console.error("[offices] GET failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/offices
  app.post("/api/offices", (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return res.status(400).json({ error: "invalid_payload" });
      }
      const name = normalizeTextField(body.name);
      if (!name) return res.status(400).json({ error: "name_required" });

      const id = randomUUID();
      const name_ko = normalizeTextField(body.name_ko) ?? "";
      const name_ja = normalizeTextField(body.name_ja) ?? "";
      const name_zh = normalizeTextField(body.name_zh) ?? "";
      const icon = normalizeTextField(body.icon) ?? "🏢";
      const description = normalizeTextField(body.description) ?? null;
      const sort_order = typeof body.sort_order === "number" ? body.sort_order : 99;

      db.prepare(
        `INSERT INTO offices (id, name, name_ko, name_ja, name_zh, icon, description, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, name, name_ko, name_ja, name_zh, icon, description, sort_order);

      syncOrganizationRelationMappings(db as any);
      const office = db.prepare("SELECT * FROM offices WHERE id = ?").get(id);
      broadcast("offices_changed", {});
      res.status(201).json(office);
    } catch (err) {
      console.error("[offices] POST failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // PATCH /api/offices/reorder  (must be before /:id)
  app.patch("/api/offices/reorder", (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const orders = body?.orders;
      if (!Array.isArray(orders)) return res.status(400).json({ error: "orders_required" });

      for (const item of orders) {
        if (!item || typeof item.id !== "string" || typeof item.sort_order !== "number") {
          return res.status(400).json({ error: "invalid_order_entry", detail: item });
        }
      }

      runInTransaction(() => {
        const stmt = db.prepare("UPDATE offices SET sort_order = ? WHERE id = ?");
        for (const item of orders) {
          stmt.run(item.sort_order, item.id);
        }
      });

      broadcast("offices_changed", {});
      res.json({ ok: true });
    } catch (err) {
      console.error("[offices] PATCH reorder failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // PATCH /api/offices/:id
  app.patch("/api/offices/:id", (req, res) => {
    try {
      const id = String(req.params.id);
      const existing = db.prepare("SELECT id FROM offices WHERE id = ?").get(id);
      if (!existing) return res.status(404).json({ error: "not_found" });

      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      const fields: string[] = [];
      const values: unknown[] = [];

      if ("name" in body) {
        const name = normalizeTextField(body.name);
        if (!name) return res.status(400).json({ error: "name_required" });
        fields.push("name = ?"); values.push(name);
      }
      if ("name_ko" in body) { fields.push("name_ko = ?"); values.push(normalizeTextField(body.name_ko) ?? ""); }
      if ("name_ja" in body) { fields.push("name_ja = ?"); values.push(normalizeTextField(body.name_ja) ?? ""); }
      if ("name_zh" in body) { fields.push("name_zh = ?"); values.push(normalizeTextField(body.name_zh) ?? ""); }
      if ("icon" in body) { fields.push("icon = ?"); values.push(normalizeTextField(body.icon) ?? "🏢"); }
      if ("description" in body) { fields.push("description = ?"); values.push(normalizeTextField(body.description) ?? null); }
      if ("sort_order" in body && typeof body.sort_order === "number") {
        fields.push("sort_order = ?"); values.push(body.sort_order);
      }

      if (fields.length === 0) return res.status(400).json({ error: "no_fields_to_update" });

      fields.push("updated_at = (unixepoch()*1000)");
      values.push(id);

      db.prepare(`UPDATE offices SET ${fields.join(", ")} WHERE id = ?`).run(...values);
      syncOrganizationRelationMappings(db as any);
      const updated = db.prepare("SELECT * FROM offices WHERE id = ?").get(id);
      broadcast("offices_changed", {});
      res.json(updated);
    } catch (err) {
      console.error("[offices] PATCH failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // DELETE /api/offices/:id
  app.delete("/api/offices/:id", (req, res) => {
    try {
      const id = String(req.params.id);
      const existing = db.prepare("SELECT id FROM offices WHERE id = ?").get(id);
      if (!existing) return res.status(404).json({ error: "not_found" });

      const boundDepartments = db.prepare("SELECT COUNT(*) AS count FROM departments WHERE office_id = ?").get(id) as
        | { count?: number }
        | undefined;
      if (Number(boundDepartments?.count ?? 0) > 0) {
        return res.status(409).json({ error: "office_has_departments" });
      }

      runInTransaction(() => {
        const boundSecretaryNodes = db
          .prepare("SELECT id, metadata_json FROM org_nodes WHERE tier = 1")
          .all() as Array<{ id: string; metadata_json: string | null }>;

        for (const node of boundSecretaryNodes) {
          const metadata = parseMetadata(node.metadata_json);
          if (metadata.office_id !== id) continue;
          const nextMetadata = { ...metadata };
          delete nextMetadata.office_id;
          db.prepare("UPDATE org_nodes SET metadata_json = ?, updated_at = (unixepoch()*1000) WHERE id = ?").run(
            Object.keys(nextMetadata).length > 0 ? JSON.stringify(nextMetadata) : null,
            node.id,
          );
        }

        db.prepare("DELETE FROM offices WHERE id = ?").run(id);
        syncOrganizationRelationMappings(db as any);
      });
      broadcast("offices_changed", {});
      res.json({ ok: true });
    } catch (err) {
      console.error("[offices] DELETE failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}

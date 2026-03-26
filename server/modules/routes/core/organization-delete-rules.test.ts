import express from "express";
import request from "supertest";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { applyBaseSchema } from "../../bootstrap/schema/base-schema.ts";
import { applyTaskSchemaMigrations } from "../../bootstrap/schema/task-schema-migrations.ts";
import { applyOrgSchemaMigrations } from "../../bootstrap/schema/org-schema-migrations.ts";
import { syncOrganizationRelationMappings } from "../../organization/relationship-mappings.ts";
import { registerOfficeRoutes } from "./offices.ts";
import { registerDepartmentRoutes } from "./departments.ts";

function normalizeTextField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function createHarness() {
  const db = new DatabaseSync(":memory:");
  applyBaseSchema(db);
  applyTaskSchemaMigrations(db);
  applyOrgSchemaMigrations(db);

  const app = express();
  app.use(express.json());

  const runInTransaction = (fn: () => void) => {
    db.exec("BEGIN");
    try {
      fn();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };

  const broadcast = () => {};

  registerOfficeRoutes({
    app,
    db: db as any,
    broadcast,
    normalizeTextField,
    runInTransaction,
  });

  registerDepartmentRoutes({
    app,
    db: db as any,
    broadcast,
    normalizeTextField,
    runInTransaction,
  });

  return { app, db };
}

describe("organization delete rules", () => {
  const dbs: DatabaseSync[] = [];

  afterEach(() => {
    while (dbs.length > 0) {
      dbs.pop()?.close();
    }
  });

  it("blocks office deletion when departments are still bound under the office", async () => {
    const { app, db } = createHarness();
    dbs.push(db);

    db.prepare(
      "INSERT INTO offices (id, name, name_ko, name_ja, name_zh, icon, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("office-a", "Alpha Office", "Alpha Office", "", "阿尔法办公室", "🏢", null, 1);
    db.prepare(
      "INSERT INTO departments (id, name, name_ko, name_ja, name_zh, office_id, icon, color, description, prompt, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("dept-a", "Alpha Dept", "Alpha Dept", "", "阿尔法部门", "office-a", "📁", "#2563eb", null, null, 1);

    const response = await request(app).delete("/api/offices/office-a");

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("office_has_departments");
    const office = db.prepare("SELECT id FROM offices WHERE id = ?").get("office-a");
    expect(office).toBeTruthy();
  });

  it("deletes an office only after clearing the bound secretary relation", async () => {
    const { app, db } = createHarness();
    dbs.push(db);

    db.prepare(
      "INSERT INTO offices (id, name, name_ko, name_ja, name_zh, icon, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("office-b", "Beta Office", "Beta Office", "", "贝塔办公室", "🏢", null, 1);
    db.prepare(
      "INSERT INTO agents (id, name, name_ko, name_ja, name_zh, department_id, workflow_pack_key, role, cli_provider, avatar_emoji, personality, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("sec-1", "Secretary One", "Secretary One", "", "秘书一号", null, "development", "senior", "codex", "🙂", null, "idle");
    db.prepare(
      "INSERT INTO org_nodes (id, name, name_ko, name_ja, name_zh, tier, parent_id, department_id, agent_id, metadata_json, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      "node-sec-1",
      "Secretary Node",
      "Secretary Node",
      "",
      "秘书节点",
      1,
      "super-ceo-root",
      null,
      "sec-1",
      JSON.stringify({ office_id: "office-b" }),
      1,
    );
    syncOrganizationRelationMappings(db as any);

    const before = db
      .prepare("SELECT office_id, secretary_agent_id FROM office_secretary_bindings WHERE office_id = ?")
      .get("office-b");
    expect(before).toBeTruthy();

    const response = await request(app).delete("/api/offices/office-b");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    const office = db.prepare("SELECT id FROM offices WHERE id = ?").get("office-b");
    expect(office).toBeUndefined();
    const node = db.prepare("SELECT metadata_json FROM org_nodes WHERE id = ?").get("node-sec-1") as
      | { metadata_json: string | null }
      | undefined;
    expect(node).toBeTruthy();
    expect(node?.metadata_json ?? null).toBeNull();
    const binding = db
      .prepare("SELECT office_id FROM office_secretary_bindings WHERE office_id = ?")
      .get("office-b");
    expect(binding).toBeUndefined();
  });

  it("blocks department deletion when employees are still bound under the department", async () => {
    const { app, db } = createHarness();
    dbs.push(db);

    db.prepare(
      "INSERT INTO departments (id, name, name_ko, name_ja, name_zh, office_id, icon, color, description, prompt, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("dept-b", "Beta Dept", "Beta Dept", "", "贝塔部门", null, "📁", "#0f766e", null, null, 1);
    db.prepare(
      "INSERT INTO agents (id, name, name_ko, name_ja, name_zh, department_id, workflow_pack_key, role, cli_provider, avatar_emoji, personality, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("emp-1", "Worker One", "Worker One", "", "员工一号", "dept-b", "development", "junior", "codex", "🙂", null, "idle");

    const response = await request(app).delete("/api/departments/dept-b");

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("department_has_employees");
    const department = db.prepare("SELECT id FROM departments WHERE id = ?").get("dept-b");
    expect(department).toBeTruthy();
  });

  it("deletes a department after unbinding its leader when no employees remain", async () => {
    const { app, db } = createHarness();
    dbs.push(db);

    db.prepare(
      "INSERT INTO departments (id, name, name_ko, name_ja, name_zh, office_id, icon, color, description, prompt, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("dept-c", "Gamma Dept", "Gamma Dept", "", "伽马部门", null, "📁", "#9333ea", null, null, 1);
    db.prepare(
      "INSERT INTO agents (id, name, name_ko, name_ja, name_zh, department_id, workflow_pack_key, role, cli_provider, avatar_emoji, personality, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("leader-1", "Leader One", "Leader One", "", "部长一号", "dept-c", "development", "team_leader", "codex", "🙂", null, "idle");
    syncOrganizationRelationMappings(db as any);

    const response = await request(app).delete("/api/departments/dept-c");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    const department = db.prepare("SELECT id FROM departments WHERE id = ?").get("dept-c");
    expect(department).toBeUndefined();
    const leader = db.prepare("SELECT department_id, role FROM agents WHERE id = ?").get("leader-1") as
      | { department_id: string | null; role: string }
      | undefined;
    expect(leader).toEqual({
      department_id: null,
      role: "senior",
    });
    const binding = db
      .prepare("SELECT department_id FROM department_leader_bindings WHERE leader_agent_id = ?")
      .get("leader-1");
    expect(binding).toBeUndefined();
  });
});

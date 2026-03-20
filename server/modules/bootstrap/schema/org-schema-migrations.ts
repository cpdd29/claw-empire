/**
 * Org Nodes Schema Migration
 * 
 * Phase 1: Add infinite-level hierarchical CEO structure support
 * - New org_nodes table for tree-based organization
 * - Optional org_node_id in agents table
 * - Cross-node communication fields in messages
 */

import type { DatabaseSync } from "node:sqlite";

type DbLike = Pick<DatabaseSync, "exec" | "prepare">;

interface OrgNodeRow {
  id: string;
  name: string;
  name_ko: string;
  name_ja: string;
  name_zh: string;
  tier: number;
  parent_id: string | null;
  department_id: string | null;
  metadata_json: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export function applyOrgSchemaMigrations(db: DbLike): void {
  ensureOrgNodesTable(db);
  ensureAgentsOrgNodeLink(db);
  ensureMessagesCrossNodeFields(db);
  seedDefaultOrgNodes(db);
}

// ---------------------------------------------------------------------------
// org_nodes table
// ---------------------------------------------------------------------------

function ensureOrgNodesTable(db: DbLike): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS org_nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_ko TEXT NOT NULL DEFAULT '',
        name_ja TEXT NOT NULL DEFAULT '',
        name_zh TEXT NOT NULL DEFAULT '',
        tier INTEGER NOT NULL DEFAULT 1 CHECK(tier >= 0),
        parent_id TEXT REFERENCES org_nodes(id) ON DELETE SET NULL,
        department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
        agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
        metadata_json TEXT,
        sort_order INTEGER DEFAULT 99,
        created_at INTEGER DEFAULT (unixepoch()*1000),
        updated_at INTEGER DEFAULT (unixepoch()*1000)
      )
    `);
    db.exec("CREATE INDEX IF NOT EXISTS idx_org_nodes_parent ON org_nodes(parent_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_org_nodes_tier ON org_nodes(tier)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_org_nodes_dept ON org_nodes(department_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_org_nodes_agent ON org_nodes(agent_id)");
  } catch {
    /* already exists */
  }

  // Add agent_id column if not exists (for existing tables)
  try {
    db.exec("ALTER TABLE org_nodes ADD COLUMN agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL");
  } catch {
    /* already exists */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_org_nodes_agent ON org_nodes(agent_id)");
  } catch {
    /* best effort */
  }

  // Migrate existing columns to ensure DEFAULT '' is set (for SQLite schema changes)
  migrateOrgNodesDefaults(db);
}

function migrateOrgNodesDefaults(db: DbLike): void {
  // Check if we need migration: look at the PRAGMA info
  try {
    const columns = db.prepare("PRAGMA table_info(org_nodes)").all() as Array<{ name: string; notnull: number; dflt_value: string | null }>;
    console.log("[Claw-Empire] Current org_nodes table structure:", JSON.stringify(columns, null, 2));
    const colMap = new Map(columns.map((c) => [c.name, c]));

    const needsMigration = ["name_ko", "name_ja", "name_zh"].some((col) => {
      const info = colMap.get(col);
      // If column has notnull=1 but dflt_value is null/empty, we need migration
      return info && info.notnull === 1 && !info.dflt_value;
    });

    if (!needsMigration) return;

    console.log("[Claw-Empire] Migrating org_nodes table to add DEFAULT '' for i18n columns...");

    // Backup existing data
    const existingNodes = db.prepare("SELECT * FROM org_nodes").all() as unknown as OrgNodeRow[];

    // Drop and recreate table with correct schema
    db.exec("DROP TABLE IF EXISTS org_nodes_backup");
    db.exec("ALTER TABLE org_nodes RENAME TO org_nodes_backup");

    db.exec(`
      CREATE TABLE org_nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_ko TEXT NOT NULL DEFAULT '',
        name_ja TEXT NOT NULL DEFAULT '',
        name_zh TEXT NOT NULL DEFAULT '',
        tier INTEGER NOT NULL DEFAULT 1 CHECK(tier >= 0),
        parent_id TEXT REFERENCES org_nodes(id) ON DELETE SET NULL,
        department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
        agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
        metadata_json TEXT,
        sort_order INTEGER DEFAULT 99,
        created_at INTEGER DEFAULT (unixepoch()*1000),
        updated_at INTEGER DEFAULT (unixepoch()*1000)
      )
    `);

    // Restore data with empty strings for missing i18n fields
    for (const node of existingNodes) {
      const n = node as OrgNodeRow & { agent_id?: string };
      db.prepare(`
        INSERT INTO org_nodes (id, name, name_ko, name_ja, name_zh, tier, parent_id, department_id, agent_id, metadata_json, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        n.id,
        n.name,
        n.name_ko ?? "",
        n.name_ja ?? "",
        n.name_zh ?? "",
        n.tier,
        n.parent_id,
        n.department_id,
        n.agent_id ?? null,
        n.metadata_json,
        n.sort_order,
        n.created_at,
        n.updated_at
      );
    }

    db.exec("DROP TABLE org_nodes_backup");
    console.log("[Claw-Empire] org_nodes migration completed");
  } catch (err) {
    console.error("[Claw-Empire] org_nodes migration failed:", err);
  }
}

// ---------------------------------------------------------------------------
// agents.org_node_id link
// ---------------------------------------------------------------------------

function ensureAgentsOrgNodeLink(db: DbLike): void {
  try {
    db.exec("ALTER TABLE agents ADD COLUMN org_node_id TEXT REFERENCES org_nodes(id) ON DELETE SET NULL");
  } catch {
    /* already exists or column already present */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_agents_org_node ON agents(org_node_id)");
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// messages cross-node communication fields
// ---------------------------------------------------------------------------

function ensureMessagesCrossNodeFields(db: DbLike): void {
  try {
    db.exec("ALTER TABLE messages ADD COLUMN org_sender_node_id TEXT REFERENCES org_nodes(id) ON DELETE SET NULL");
  } catch {
    /* already exists or column already present */
  }
  try {
    db.exec("ALTER TABLE messages ADD COLUMN org_receiver_node_id TEXT REFERENCES org_nodes(id) ON DELETE SET NULL");
  } catch {
    /* already exists or column already present */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_messages_org_sender ON messages(org_sender_node_id)");
  } catch {
    /* best effort */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_messages_org_receiver ON messages(org_receiver_node_id)");
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Seed default org nodes for existing data (backward compatibility)
// ---------------------------------------------------------------------------

function seedDefaultOrgNodes(db: DbLike): void {
  // Check if org_nodes already has data
  const count = (db.prepare("SELECT COUNT(*) AS cnt FROM org_nodes").get() as { cnt: number });
  if (count.cnt > 0) return;

  console.log("[Claw-Empire] Seeding default org_nodes from existing departments");

  // Create SuperCEO node (tier=0)
  // Role: 唯一根节点，下达战略任务
  const superCeoId = "super-ceo-root";
  try {
    db.prepare(`
      INSERT OR IGNORE INTO org_nodes (id, name, name_ko, name_ja, name_zh, tier, parent_id, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(superCeoId, "SuperCEO", "슈퍼 CEO", "最高CEO", "超级CEO", 0, null, 0);
  } catch {
    /* ignore */
  }

  // Get all existing departments and create org_nodes for them
  interface DeptRow {
    id: string;
    name: string;
    name_ko: string;
    name_ja: string;
    name_zh: string;
  }
  const rawDepts = db.prepare("SELECT id, name, name_ko, name_ja, name_zh FROM departments").all();
  const departments: DeptRow[] = (rawDepts as unknown) as DeptRow[];

  for (const dept of departments) {
    const nodeId = "dept-" + dept.id;
    try {
      db.prepare(`
        INSERT OR IGNORE INTO org_nodes (
          id, name, name_ko, name_ja, name_zh, tier, parent_id, department_id, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        nodeId,
        dept.name,
        dept.name_ko,
        dept.name_ja || "",
        dept.name_zh || "",
        1, // tier 1 = Secretary (拆解任务+分配给组长+管理记忆+跨部门协调)
        superCeoId,
        dept.id,
        1,
      );
    } catch {
      /* ignore duplicate or FK issues */
    }
  }

  // Link existing agents to their department org_nodes
  try {
    db.exec(`
      UPDATE agents
      SET org_node_id = (
        SELECT on2.id FROM org_nodes on2
        WHERE on2.department_id = agents.department_id
          AND on2.tier = 1
        LIMIT 1
      )
      WHERE org_node_id IS NULL
        AND department_id IS NOT NULL
    `);
  } catch {
    /* best effort */
  }

  console.log("[Claw-Empire] Default org_nodes seeded successfully");
}

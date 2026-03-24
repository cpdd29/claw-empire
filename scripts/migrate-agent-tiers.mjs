#!/usr/bin/env node

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(scriptDir, "..", "claw-empire.sqlite");
const dbPath = String(process.env.DB_PATH || defaultDbPath).trim();

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

const ROLE_TO_TIER = {
  team_leader: 2,
  senior: 3,
  junior: 3,
  intern: 3,
};

function getTier(role) {
  return ROLE_TO_TIER[role] ?? 3;
}

const db = new DatabaseSync(dbPath);

const agents = db.prepare("SELECT id, name, role, department_id FROM agents").all();
const existingNodes = db.prepare("SELECT agent_id FROM org_nodes WHERE agent_id IS NOT NULL").all();
const assignedAgentIds = new Set(existingNodes.map((n) => n.agent_id));

// 找每个部门的 tier=1（秘书）节点
const secretaryNodes = db.prepare("SELECT id, name, department_id FROM org_nodes WHERE tier = 1").all();
const deptSecretaryMap = new Map();
console.log("\n[DEBUG] 秘书节点列表：");
for (const node of secretaryNodes) {
  console.log(`  id=${node.id} name=${node.name} department_id=${node.department_id ?? "(空)"}`);
  if (node.department_id) deptSecretaryMap.set(node.department_id, node.id);
}
console.log(`[DEBUG] deptSecretaryMap keys: ${[...deptSecretaryMap.keys()].join(", ") || "(无)"}\n`);

const insert = db.prepare(
  `INSERT INTO org_nodes (id, name, tier, department_id, parent_id, agent_id)
   VALUES (?, ?, ?, ?, ?, ?)`
);

let created = 0;
let skipped = 0;

for (const agent of agents) {
  if (assignedAgentIds.has(agent.id)) {
    console.log(`[SKIP] ${agent.name} (${agent.id}) — 已有 org_node`);
    skipped++;
    continue;
  }

  const tier = getTier(agent.role);
  const nodeId = `org-migrate-${agent.id}`;
  const parentId = agent.department_id ? (deptSecretaryMap.get(agent.department_id) ?? null) : null;

  console.log(
    `[${dryRun ? "DRY" : "CREATE"}] ${agent.name} | role=${agent.role} → tier=${tier} | dept=${agent.department_id ?? "none"} | parent=${parentId ?? "none"}`
  );

  if (!dryRun) {
    insert.run(nodeId, agent.name, tier, agent.department_id ?? null, parentId, agent.id);
  }
  created++;
}

console.log(`\n完成：新建 ${created} 条，跳过 ${skipped} 条${dryRun ? "（dry-run 模式，未写入）" : ""}`);

db.close();

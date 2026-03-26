import type { DatabaseSync } from "node:sqlite";

type DbLike = Pick<DatabaseSync, "prepare">;

type DepartmentRow = { id: string; office_id: string | null };
type AgentRow = { id: string; department_id: string | null; role: string };
type OrgNodeRow = { id: string; tier: number; agent_id: string | null; metadata_json: string | null };

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function normalizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function syncOrganizationRelationMappings(db: DbLike): void {
  const departments = db.prepare("SELECT id, office_id FROM departments").all() as DepartmentRow[];
  const agents = db.prepare("SELECT id, department_id, role FROM agents").all() as AgentRow[];
  const orgNodes = db.prepare("SELECT id, tier, agent_id, metadata_json FROM org_nodes").all() as OrgNodeRow[];
  const now = Date.now();

  const officeSecretaryBindings: Array<{ office_id: string; secretary_agent_id: string; org_node_id: string }> = [];
  const seenOfficeIds = new Set<string>();
  const seenSecretaryIds = new Set<string>();
  for (const node of orgNodes) {
    if (Number(node.tier) !== 1) continue;
    const metadata = parseMetadata(node.metadata_json);
    const officeId = normalizeId(metadata.office_id);
    const secretaryAgentId = normalizeId(node.agent_id ?? metadata.agent_id);
    if (!officeId || !secretaryAgentId) continue;
    if (seenOfficeIds.has(officeId) || seenSecretaryIds.has(secretaryAgentId)) continue;
    seenOfficeIds.add(officeId);
    seenSecretaryIds.add(secretaryAgentId);
    officeSecretaryBindings.push({
      office_id: officeId,
      secretary_agent_id: secretaryAgentId,
      org_node_id: node.id,
    });
  }

  const officeSecretaryByOffice = new Map(
    officeSecretaryBindings.map((binding) => [binding.office_id, binding.secretary_agent_id]),
  );

  const secretaryDepartmentBindings: Array<{
    secretary_agent_id: string;
    department_id: string;
    office_id: string;
  }> = [];
  for (const department of departments) {
    const officeId = normalizeId(department.office_id);
    if (!officeId) continue;
    const secretaryAgentId = officeSecretaryByOffice.get(officeId);
    if (!secretaryAgentId) continue;
    secretaryDepartmentBindings.push({
      secretary_agent_id: secretaryAgentId,
      department_id: department.id,
      office_id: officeId,
    });
  }

  const departmentLeaderBindings = agents
    .filter((agent) => agent.role === "team_leader" && normalizeId(agent.department_id))
    .map((agent) => ({
      department_id: normalizeId(agent.department_id)!,
      leader_agent_id: agent.id,
    }));

  const departmentMemberBindings = agents
    .filter((agent) => ["junior", "intern"].includes(agent.role) && normalizeId(agent.department_id))
    .map((agent) => ({
      department_id: normalizeId(agent.department_id)!,
      member_agent_id: agent.id,
    }));

  db.prepare("DELETE FROM office_secretary_bindings").run();
  db.prepare("DELETE FROM secretary_department_bindings").run();
  db.prepare("DELETE FROM department_leader_bindings").run();
  db.prepare("DELETE FROM department_member_bindings").run();

  const insertOfficeSecretary = db.prepare(
    `INSERT INTO office_secretary_bindings (office_id, secretary_agent_id, org_node_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const binding of officeSecretaryBindings) {
    insertOfficeSecretary.run(binding.office_id, binding.secretary_agent_id, binding.org_node_id, now, now);
  }

  const insertSecretaryDepartment = db.prepare(
    `INSERT INTO secretary_department_bindings (secretary_agent_id, department_id, office_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const binding of secretaryDepartmentBindings) {
    insertSecretaryDepartment.run(binding.secretary_agent_id, binding.department_id, binding.office_id, now, now);
  }

  const insertDepartmentLeader = db.prepare(
    `INSERT INTO department_leader_bindings (department_id, leader_agent_id, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  );
  for (const binding of departmentLeaderBindings) {
    insertDepartmentLeader.run(binding.department_id, binding.leader_agent_id, now, now);
  }

  const insertDepartmentMember = db.prepare(
    `INSERT INTO department_member_bindings (department_id, member_agent_id, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  );
  for (const binding of departmentMemberBindings) {
    insertDepartmentMember.run(binding.department_id, binding.member_agent_id, now, now);
  }
}

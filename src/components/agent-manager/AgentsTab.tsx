import type { Agent, Department, Office } from "../../types";
import AgentCard from "./AgentCard";
import { StackedSpriteIcon } from "./EmojiPicker";
import type { Translator } from "./types";
import type { OrgNode } from "../../types/org-nodes";

interface AgentsTabProps {
  tr: Translator;
  locale: string;
  agents: Agent[];
  offices: Office[];
  departments: Department[];
  orgNodes: OrgNode[];
  sortedAgents: Agent[];
  spriteMap: Map<string, number>;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  onEditAgent: (agent: Agent) => void;
  onDeleteAgent: (agent: Agent) => void;
  onDuplicateAgent: (agent: Agent) => void;
  onIdentityClick: (agent: Agent) => void;
  saving: boolean;
  randomIconSprites: {
    total: [number, number];
  };
}

export default function AgentsTab({
  tr,
  locale,
  agents,
  offices,
  departments,
  orgNodes,
  sortedAgents,
  spriteMap,
  confirmDeleteId,
  setConfirmDeleteId,
  onEditAgent,
  onDeleteAgent,
  onDuplicateAgent,
  onIdentityClick,
  saving,
  randomIconSprites,
}: AgentsTabProps) {
  const workingCount = agents.filter((agent) => agent.status === "working").length;
  const assignedDepartmentCount = agents.filter((agent) => agent.department_id).length;

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div
          className="rounded-2xl p-4"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(59,130,246,0.16), transparent 48%), linear-gradient(135deg, rgba(255,255,255,0.14), rgba(15,23,42,0.03)), var(--th-card-bg)",
            border: "1px solid var(--th-card-border)",
            boxShadow: "0 18px 40px -28px rgba(59,130,246,0.35)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.24em]"
                style={{ color: "var(--th-text-muted)" }}
              >
                {tr("员工总数", "Total Employees")}
              </div>
              <div className="mt-3 text-4xl font-semibold tabular-nums" style={{ color: "var(--th-text-heading)" }}>
                {agents.length}
              </div>
              <div className="mt-2 text-sm" style={{ color: "var(--th-text-muted)" }}>
                {tr("已绑定部门", "Assigned Departments")} {assignedDepartmentCount}
              </div>
            </div>
            <div
              className="rounded-2xl px-3 py-2"
              style={{
                background: "var(--th-bg-surface)",
                border: "1px solid var(--th-card-border)",
                color: "var(--th-text-heading)",
              }}
            >
              <StackedSpriteIcon sprites={randomIconSprites.total} />
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl p-4"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(16,185,129,0.16), transparent 46%), linear-gradient(135deg, rgba(255,255,255,0.12), rgba(15,23,42,0.025)), var(--th-card-bg)",
            border: "1px solid var(--th-card-border)",
            boxShadow: "0 18px 40px -28px rgba(16,185,129,0.28)",
          }}
        >
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.24em]"
            style={{ color: "var(--th-text-muted)" }}
          >
            {tr("工作中", "Working")}
          </div>
          <div className="mt-3 text-4xl font-semibold tabular-nums" style={{ color: "var(--th-text-heading)" }}>
            {workingCount}
          </div>
          <div className="mt-2 text-sm" style={{ color: "var(--th-text-muted)" }}>
            {tr("当前可见员工卡片可继续按搜索与部门状态筛选。", "Use search and department status filters to narrow the list.")}
          </div>
        </div>
      </div>

      {sortedAgents.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--th-text-muted)" }}>
          <div className="text-3xl mb-2">🔍</div>
          {tr("未找到员工", "No employees found")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              spriteMap={spriteMap}
              locale={locale}
              tr={tr}
              offices={offices}
              departments={departments}
              orgNodes={orgNodes}
              onEdit={() => onEditAgent(agent)}
              onDuplicate={() => onDuplicateAgent(agent)}
              onIdentityClick={() => onIdentityClick(agent)}
              confirmDeleteId={confirmDeleteId}
              onDeleteClick={() => setConfirmDeleteId(agent.id)}
              onDeleteConfirm={() => onDeleteAgent(agent)}
              onDeleteCancel={() => setConfirmDeleteId(null)}
              saving={saving}
            />
          ))}
        </div>
      )}
    </>
  );
}

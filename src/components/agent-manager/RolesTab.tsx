import { useState } from "react";
import type { Office, Department, Agent } from "../../types";
import type { Translator } from "./types";
import { localeName } from "../../i18n";
import AgentDetailModal from "./AgentDetailModal";

interface RolesTabProps {
  tr: Translator;
  locale: string;
  agents: Agent[];
  offices: Office[];
  departments: Department[];
  officeSecretaryAgentIdByOffice?: Record<string, string>;
}

export default function RolesTab({
  tr,
  locale,
  agents,
  offices,
  departments,
  officeSecretaryAgentIdByOffice = {},
}: RolesTabProps) {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const ceoAgents = agents.filter((a) => a.role === "team_leader" && !a.department_id);
  const secretaryAgents = agents.filter((a) => a.role === "senior");
  const leaderAgents = agents.filter((a) => a.role === "team_leader" && a.department_id);
  const juniorAgents = agents.filter((a) => a.role === "junior");
  const internAgents = agents.filter((a) => a.role === "intern");

  const statusLabel = (status: Agent["status"]) => {
    if (status === "working") return tr("工作中", "Working");
    if (status === "idle") return tr("空闲", "Idle");
    if (status === "break") return tr("休息中", "Break");
    if (status === "offline") return tr("离线", "Offline");
    return status;
  };

  const getAgentOfficeDepartmentSummary = (agent: Agent) => {
    const department = departments.find((item) => item.id === agent.department_id) ?? null;
    const isSecretary = agent.role === "senior";
    const office = isSecretary
      ? offices.find((item) => officeSecretaryAgentIdByOffice[item.id] === agent.id) ?? null
      : (department?.office_id ? offices.find((item) => item.id === department.office_id) ?? null : null);

    return {
      isSecretary,
      officeLabel: office ? `${office.icon} ${localeName(locale, office)}` : tr("未绑定办公室", "No Office"),
      departmentLabel: department ? `${department.icon} ${localeName(locale, department)}` : tr("未绑定部门", "No Department"),
    };
  };

  const RoleSection = ({
    title,
    icon,
    agentList,
    color,
  }: {
    title: string;
    icon: string;
    agentList: Agent[];
    color: string;
  }) => (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--th-card-border)", background: "var(--th-card-bg)" }}
    >
      <h3 className="text-base font-semibold mb-3" style={{ color }}>
        <span className="mr-2">{icon}</span>
        {title} ({agentList.length})
      </h3>
      {agentList.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--th-text-muted)" }}>
          {tr("暂无", "No agents")}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {agentList.map((agent) => (
            (() => {
              const summary = getAgentOfficeDepartmentSummary(agent);
              return (
                <div
                  key={agent.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedAgent(agent)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedAgent(agent);
                    }
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all hover:shadow-sm hover:border-slate-500"
                  style={{ borderColor: "var(--th-card-border)", background: "var(--th-bg)" }}
                >
                  <div className="text-2xl">{agent.avatar_emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" style={{ color: "var(--th-text)" }}>
                      {agent.name}
                    </div>
                    <div className="mt-1 space-y-1 text-xs" style={{ color: "var(--th-text-muted)" }}>
                      <div className="truncate">
                        {tr("办公室", "Office")}: {summary.officeLabel}
                      </div>
                      {!summary.isSecretary && (
                        <div className="truncate">
                          {tr("部门", "Department")}: {summary.departmentLabel}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    agent.status === "working" ? "bg-green-100 text-green-700" :
                    agent.status === "idle" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {statusLabel(agent.status)}
                  </div>
                </div>
              );
            })()
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="space-y-4">
        <RoleSection
          title={tr("超级 CEO", "SuperCEO")}
          icon="👑"
          agentList={ceoAgents}
          color="#D97706"
        />
        <RoleSection
          title={tr("秘书", "Secretaries")}
          icon="📋"
          agentList={secretaryAgents}
          color="#7C3AED"
        />
        <RoleSection
          title={tr("负责人", "Leaders")}
          icon="👥"
          agentList={leaderAgents}
          color="#0891B2"
        />
        <RoleSection
          title={tr("成员", "Agents")}
          icon="⚡"
          agentList={[...juniorAgents, ...internAgents]}
          color="#F97316"
        />
      </div>

      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          offices={offices}
          departments={departments}
          locale={locale}
          tr={tr}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </>
  );
}

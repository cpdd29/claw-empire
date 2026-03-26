import type { Agent, Department, Office } from "../../types";
import { localeName } from "../../i18n";
import AgentAvatar from "../AgentAvatar";
import { STATUS_DOT } from "./constants";
import type { Translator } from "./types";
import type { OrgNode } from "../../types/org-nodes";

interface AgentCardProps {
  agent: Agent;
  spriteMap: Map<string, number>;
  locale: string;
  tr: Translator;
  offices: Office[];
  departments: Department[];
  orgNodes: OrgNode[];
  onEdit: () => void;
  onDuplicate: () => void;
  onIdentityClick: () => void;
  confirmDeleteId: string | null;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  saving: boolean;
}

export default function AgentCard({
  agent,
  spriteMap,
  locale,
  tr,
  offices,
  departments,
  orgNodes,
  onEdit,
  onDuplicate,
  onIdentityClick,
  confirmDeleteId,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
  saving,
}: AgentCardProps) {
  const isDeleting = confirmDeleteId === agent.id;
  const dept = departments.find((d) => d.id === agent.department_id);

  // Find org node identity by matching agent_id (check both agent_id field and metadata_json.agent_id)
  const findOrgNode = (): OrgNode | undefined => {
    return orgNodes.find((node) => {
      // Check direct agent_id field
      if (node.agent_id === agent.id) return true;
      // Check metadata_json.agent_id
      if (node.metadata_json) {
        try {
          const meta = JSON.parse(node.metadata_json);
          if (meta.agent_id === agent.id) return true;
        } catch {
          // Ignore malformed metadata and fall back to direct field matching.
        }
      }
      return false;
    });
  };

  const orgNode = findOrgNode();
  const isSecretary = agent.role === "senior";
  const officeIdFromNode = (() => {
    if (!orgNode?.metadata_json) return null;
    try {
      const metadata = JSON.parse(orgNode.metadata_json) as Record<string, unknown>;
      return typeof metadata.office_id === "string" ? metadata.office_id : null;
    } catch {
      return null;
    }
  })();
  const office = isSecretary
    ? (officeIdFromNode ? offices.find((item) => item.id === officeIdFromNode) ?? null : null)
    : (dept?.office_id ? offices.find((item) => item.id === dept.office_id) ?? null : null);

  const TIER_BADGE: Record<number, { label: string; cls: string }> = {
    0: { label: "👑 SuperCEO", cls: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
    1: { label: "📋 秘书",     cls: "bg-violet-500/15 text-violet-400 border border-violet-500/30" },
    2: { label: "👥 组长",     cls: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" },
    3: { label: "⚡ 员工",     cls: "bg-orange-500/15 text-orange-400 border border-orange-500/30" },
  };

  const CLI_DISPLAY: Record<string, string> = {
    claude: "Claude Code",
    api: "API 直连",
    opencode: "OpenCode",
    gemini: "Gemini CLI",
    codex: "Codex CLI",
    kimi: "Kimi Code",
    copilot: "GitHub Copilot",
    antigravity: "Antigravity",
  };

  const officeName = office ? localeName(locale, office) : null;
  const departmentName = dept ? localeName(locale, dept) : null;

  return (
    <div
      onClick={onEdit}
      className="group rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg hover:shadow-black/10"
      style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <AgentAvatar agent={agent} spriteMap={spriteMap} size={44} rounded="xl" />
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${STATUS_DOT[agent.status] ?? STATUS_DOT.idle}`}
            style={{ borderColor: "var(--th-card-bg)" }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm truncate" style={{ color: "var(--th-text-heading)" }}>
              {localeName(locale, agent)}
            </span>
            <span className="text-[10px] shrink-0" style={{ color: "var(--th-text-muted)" }}>
              {(() => {
                const primary = localeName(locale, agent);
                const sub = locale === "en" ? agent.name_ko || "" : agent.name;
                return primary !== sub ? sub : "";
              })()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {orgNode != null && TIER_BADGE[orgNode.tier] ? (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${TIER_BADGE[orgNode.tier].cls}`}>
                {TIER_BADGE[orgNode.tier].label}
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md border font-medium bg-slate-500/15 text-slate-400 border-slate-500/30">
                未分配
              </span>
            )}
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-md"
              style={{ background: "var(--th-bg-surface)", color: "var(--th-text-muted)" }}
            >
              {office ? `${office.icon} ${officeName}` : tr("未绑定办公室", "No Office")}
            </span>
            {!isSecretary && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-md"
                style={{ background: "var(--th-bg-surface)", color: "var(--th-text-muted)" }}
              >
                {dept ? `${dept.icon} ${departmentName}` : tr("未绑定部门", "No Department")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        className="mt-3 space-y-2 border-t pt-2.5"
        style={{ borderTop: "1px solid var(--th-card-border)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: "var(--th-bg-surface)", color: "var(--th-text-muted)" }}
          >
            {tr("绑定 Agent", "Bound Agent")} · {CLI_DISPLAY[agent.cli_provider] ?? agent.cli_provider}
          </span>
        </div>
        <div
          className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onDuplicate}
            className="px-1.5 py-0.5 rounded text-xs hover:bg-blue-500/15 hover:text-blue-400 transition-colors"
            style={{ color: "var(--th-text-muted)" }}
            title={tr("复制", "Duplicate")}
          >
            📋
          </button>
          {isDeleting ? (
            <>
              <button
                onClick={onDeleteConfirm}
                disabled={saving || agent.status === "working"}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 transition-colors"
              >
                {tr("移除", "Fire")}
              </button>
              <button
                onClick={onDeleteCancel}
                className="px-2 py-0.5 rounded text-[10px] transition-colors"
                style={{ color: "var(--th-text-muted)" }}
              >
                {tr("取消", "No")}
              </button>
            </>
          ) : (
            <button
              onClick={onDeleteClick}
              className="px-1.5 py-0.5 rounded text-xs hover:bg-red-500/15 hover:text-red-400 transition-colors"
              style={{ color: "var(--th-text-muted)" }}
              title={tr("移除", "Fire")}
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

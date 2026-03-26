import { useEffect, useMemo, useRef } from "react";
import type { Agent, Department, Office } from "../../types";
import { localeName } from "../../i18n";
import type { Translator } from "./types";

const CLI_LABEL: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex CLI",
  gemini: "Gemini CLI",
  opencode: "OpenCode",
  kimi: "Kimi Code",
  copilot: "GitHub Copilot",
  antigravity: "Antigravity",
  api: "API (直连)",
};

const ROLE_LABEL: Record<Agent["role"], string> = {
  team_leader: "组长",
  senior: "秘书",
  junior: "员工",
  intern: "实习生",
};

export default function AgentDetailModal({
  agent,
  offices,
  departments,
  locale,
  tr,
  onClose,
}: {
  agent: Agent;
  offices: Office[];
  departments: Department[];
  locale: string;
  tr: Translator;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const department = useMemo(
    () => departments.find((item) => item.id === agent.department_id) ?? null,
    [agent.department_id, departments],
  );
  const office = useMemo(
    () => (department?.office_id ? offices.find((item) => item.id === department.office_id) ?? null : null),
    [department?.office_id, offices],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const inputCls =
    "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none";
  const inputStyle = {
    background: "var(--th-input-bg)",
    borderColor: "var(--th-input-border)",
    color: "var(--th-text-primary)",
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--th-modal-overlay)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: "var(--th-card-bg)",
          border: "1px solid var(--th-card-border)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ color: "var(--th-text-heading)" }}>
            {tr("员工详情", "Employee Details")}
          </h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--th-bg-surface-hover)]"
            style={{ color: "var(--th-text-muted)" }}
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-4">
            <div
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--th-text-muted)" }}
            >
              {tr("基本信息", "Basic Info")}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
                {tr("名称", "Name")} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={localeName(locale, agent)}
                readOnly
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
                {tr("所属办公室", "Office")}
              </label>
              <input
                type="text"
                value={office ? `${office.icon} ${localeName(locale, office)}` : tr("— 未分配 —", "— Unassigned —")}
                readOnly
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
                {tr("所属部门", "Department")}
              </label>
              <input
                type="text"
                value={department ? `${department.icon} ${localeName(locale, department)}` : tr("— 未分配 —", "— Unassigned —")}
                readOnly
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--th-text-muted)" }}
            >
              {tr("角色配置", "Role Config")}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
                {tr("角色", "Role")}
              </label>
              <input
                type="text"
                value={ROLE_LABEL[agent.role] ?? agent.role}
                readOnly
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
                {tr("执行方式", "Execution Method")}
              </label>
              <input
                type="text"
                value={CLI_LABEL[agent.cli_provider] ?? agent.cli_provider}
                readOnly
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 w-full">
          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
            {tr("人物属性 (soul.md)", "Personality (soul.md)")}
          </label>
          <textarea
            value={agent.personality || ""}
            readOnly
            rows={3}
            className={`${inputCls} resize-none`}
            style={inputStyle}
          />
        </div>

        <div className="mt-5 flex gap-2 border-t pt-4" style={{ borderTopColor: "var(--th-card-border)" }}>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg px-4 py-2.5 text-sm font-medium transition-all hover:bg-[var(--th-bg-surface-hover)]"
            style={{ border: "1px solid var(--th-input-border)", color: "var(--th-text-secondary)" }}
          >
            {tr("关闭", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}

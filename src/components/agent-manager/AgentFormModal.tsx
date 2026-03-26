import { useEffect, useRef, useState } from "react";
import type { Department, CliStatusMap, Office } from "../../types";
import { localeName } from "../../i18n";
import type { FormData } from "./types";
import { getCliStatus } from "../../api";

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

const CLI_TAG_STYLE: Record<string, { active: string; idle: string; dot: string }> = {
  claude: {
    active: "rgba(59,130,246,0.18)",
    idle: "rgba(59,130,246,0.1)",
    dot: "#60a5fa",
  },
  codex: {
    active: "rgba(14,165,233,0.18)",
    idle: "rgba(14,165,233,0.1)",
    dot: "#38bdf8",
  },
  gemini: {
    active: "rgba(16,185,129,0.18)",
    idle: "rgba(16,185,129,0.1)",
    dot: "#34d399",
  },
  opencode: {
    active: "rgba(249,115,22,0.18)",
    idle: "rgba(249,115,22,0.1)",
    dot: "#fb923c",
  },
  kimi: {
    active: "rgba(168,85,247,0.18)",
    idle: "rgba(168,85,247,0.1)",
    dot: "#c084fc",
  },
  copilot: {
    active: "rgba(244,114,182,0.18)",
    idle: "rgba(244,114,182,0.1)",
    dot: "#f472b6",
  },
  antigravity: {
    active: "rgba(250,204,21,0.18)",
    idle: "rgba(250,204,21,0.1)",
    dot: "#facc15",
  },
  api: {
    active: "rgba(148,163,184,0.22)",
    idle: "rgba(148,163,184,0.12)",
    dot: "#cbd5e1",
  },
};

const ROLE_TABS = [
  { tier: 0 as const, label: "SuperCEO", hint: "企业级 Agent / Soul / Memory" },
  { tier: 1 as const, label: "秘书", hint: "办公室 + Agent / Soul / Memory" },
  { tier: 2 as const, label: "部长", hint: "办公室 / 部门 / Agent 配置" },
  { tier: 3 as const, label: "员工", hint: "办公室 / 部门 / Agent 配置" },
];

function mapTierToRole(tier: 0 | 1 | 2 | 3): FormData["role"] {
  if (tier === 1) return "senior";
  if (tier === 0 || tier === 2) return "team_leader";
  return "junior";
}

export default function AgentFormModal({
  isKo,
  locale,
  tr,
  form,
  setForm,
  offices,
  departments,
  currentAgentId,
  officeSecretaryAgentIdByOffice,
  isEdit,
  saving,
  onSave,
  onClose,
}: {
  isKo: boolean;
  locale: string;
  tr: (ko: string, en: string) => string;
  form: FormData;
  setForm: (f: FormData) => void;
  offices: Office[];
  departments: Department[];
  currentAgentId: string | null;
  officeSecretaryAgentIdByOffice: Map<string, string>;
  isEdit: boolean;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  void isKo;
  const overlayRef = useRef<HTMLDivElement>(null);
  const [cliStatus, setCliStatus] = useState<CliStatusMap | null>(null);

  useEffect(() => {
    getCliStatus().then(setCliStatus).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const inputCls =
    "w-full rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30";
  const inputStyle = {
    background: "var(--th-input-bg)",
    borderColor: "var(--th-input-border)",
    color: "var(--th-text-primary)",
  };

  const textareaCls = `${inputCls} min-h-[124px] resize-y`;
  const installedCli = Object.entries(cliStatus ?? {}).filter(([, status]) => status.installed);
  const providerOptions =
    cliStatus === null
      ? [{ key: form.cli_provider, label: CLI_LABEL[form.cli_provider] ?? form.cli_provider }]
      : [
          ...installedCli.map(([key]) => ({
            key,
            label: CLI_LABEL[key] ?? key,
          })),
          ...(!installedCli.some(([key]) => key === "api") ? [{ key: "api", label: CLI_LABEL.api }] : []),
        ];

  const showOffice = form.tier !== 0;
  const showDepartment = form.tier === 2 || form.tier === 3;
  const showPersonality = form.tier === 0 || form.tier === 1;
  const showMemoryConfig = form.tier === 0 || form.tier === 1;
  const isSecretaryTier = form.tier === 1;

  const officeOptions = isSecretaryTier
    ? offices.filter((office) => {
        const boundAgentId = officeSecretaryAgentIdByOffice.get(office.id);
        return !boundAgentId || boundAgentId === currentAgentId;
      })
    : offices;

  const filteredDepartments = form.office_id
    ? departments.filter((department) => (department.office_id ?? "") === form.office_id)
    : [];

  const currentRoleMeta = ROLE_TABS.find((item) => item.tier === form.tier) ?? ROLE_TABS[3];
  const requiresPersonality = showPersonality;
  const requiresMemoryConfig = showMemoryConfig;
  const canSave =
    Boolean(form.name.trim()) &&
    (!isSecretaryTier || Boolean(form.office_id.trim())) &&
    Boolean(form.agent_config.trim()) &&
    (!requiresPersonality || Boolean(form.personality.trim())) &&
    (!requiresMemoryConfig || Boolean(form.memory_config.trim()));

  const updateRoleTab = (nextTier: 0 | 1 | 2 | 3) => {
    const nextRole = mapTierToRole(nextTier);
    if (nextTier === 0) {
      setForm({
        ...form,
        tier: nextTier,
        role: nextRole,
        office_id: "",
        department_id: "",
      });
      return;
    }
    if (nextTier === 1) {
      setForm({
        ...form,
        tier: nextTier,
        role: nextRole,
        office_id: "",
        department_id: "",
      });
      return;
    }
    setForm({
      ...form,
      tier: nextTier,
      role: nextRole,
      department_id: form.office_id ? form.department_id : "",
    });
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
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto overscroll-contain rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: "var(--th-card-bg)",
          border: "1px solid var(--th-card-border)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-bold" style={{ color: "var(--th-text-heading)" }}>
              {isEdit ? "编辑员工" : "新建员工"}
            </h3>
            <p className="text-xs" style={{ color: "var(--th-text-muted)" }}>
              {currentRoleMeta.hint}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-[var(--th-bg-surface-hover)]"
            style={{ color: "var(--th-text-muted)" }}
          >
            ✕
          </button>
        </div>

        <div className="mb-5">
          <div className="mb-2 text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
            角色
          </div>
          <div
            className="grid grid-cols-2 gap-2 rounded-2xl border p-2 md:grid-cols-4"
            style={{
              borderColor: "var(--th-card-border)",
              background: "color-mix(in srgb, var(--th-bg-surface) 72%, transparent)",
            }}
          >
            {ROLE_TABS.map((tab) => {
              const active = form.tier === tab.tier;
              return (
                <button
                  key={tab.tier}
                  type="button"
                  onClick={() => updateRoleTab(tab.tier)}
                  className="rounded-xl px-3 py-2 text-left transition-all"
                  style={{
                    background: active ? "rgba(37,99,235,0.16)" : "transparent",
                    border: active ? "1px solid rgba(59,130,246,0.42)" : "1px solid transparent",
                    color: active ? "var(--th-text-heading)" : "var(--th-text-secondary)",
                    boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.06)" : "none",
                  }}
                >
                  <div className="text-sm font-semibold">{tab.label}</div>
                  <div className="mt-0.5 text-[11px] opacity-75">{tab.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-1">
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
              名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="请输入员工名称"
              className={inputCls}
              style={inputStyle}
            />
          </div>

            <div className="md:col-span-1">
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
                Agent <span className="text-red-400">*</span>
              </label>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {providerOptions.map((option) => {
                const active = form.cli_provider === option.key;
                const palette = CLI_TAG_STYLE[option.key] ?? CLI_TAG_STYLE.api;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setForm({ ...form, cli_provider: option.key as typeof form.cli_provider })}
                    className="inline-flex items-center rounded-lg border px-3 py-1 text-xs font-medium leading-5 transition-all duration-150"
                    style={{
                      borderColor: active ? "rgba(59,130,246,0.32)" : "rgba(148,163,184,0.18)",
                      background: active ? palette.active : "transparent",
                      color: active ? "var(--th-text-heading)" : "var(--th-text-secondary)",
                      boxShadow: active
                        ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 10px rgba(15,23,42,0.12)"
                        : "none",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {showOffice && (
            <div className={showDepartment ? "md:col-span-1" : "md:col-span-2"}>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
                所属办公室 {isSecretaryTier ? <span className="text-red-400">*</span> : null}
              </label>
              <select
                value={form.office_id}
                onChange={(e) => {
                  const nextOfficeId = e.target.value;
                  if (isSecretaryTier) {
                    setForm({ ...form, office_id: nextOfficeId, department_id: "" });
                    return;
                  }
                  const nextDepartments = nextOfficeId
                    ? departments.filter((department) => (department.office_id ?? "") === nextOfficeId)
                    : [];
                  const nextDepartmentId = nextDepartments.some((department) => department.id === form.department_id)
                    ? form.department_id
                    : "";
                  setForm({ ...form, office_id: nextOfficeId, department_id: nextDepartmentId });
                }}
                className={`${inputCls} cursor-pointer`}
                style={inputStyle}
              >
                <option value="">请选择办公室</option>
                {officeOptions.map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.icon} {localeName(locale, office)}
                  </option>
                ))}
              </select>
              {isSecretaryTier && officeOptions.length === 0 && (
                <div className="mt-1.5 text-xs" style={{ color: "var(--th-text-muted)" }}>
                  当前没有可分配给秘书的空闲办公室
                </div>
              )}
            </div>
          )}

          {showDepartment && (
            <div className="md:col-span-1">
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
                所属部门
              </label>
              <select
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                disabled={!form.office_id}
                className={`${inputCls} cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`}
                style={inputStyle}
              >
                <option value="">
                  {!form.office_id
                    ? "请先选择办公室"
                    : filteredDepartments.length > 0
                      ? "不分配部门"
                      : "当前办公室暂无部门"}
                </option>
                {filteredDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.icon} {localeName(locale, department)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showPersonality && (
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
                人物属性（soul.md） <span className="text-red-400">*</span>
              </label>
              <textarea
                value={form.personality}
                onChange={(e) => setForm({ ...form, personality: e.target.value })}
                rows={4}
                placeholder="填写该角色的语气、边界、行为准则等人格设定"
                className={textareaCls}
                style={inputStyle}
              />
            </div>
          )}

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
              Agent 配置（agents.md） <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.agent_config}
              onChange={(e) => setForm({ ...form, agent_config: e.target.value })}
              rows={5}
              placeholder="填写该角色的 Agent 配置、工具策略、执行规则等内容"
              className={textareaCls}
              style={inputStyle}
            />
          </div>

          {showMemoryConfig && (
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
                记忆配置（memory.md） <span className="text-red-400">*</span>
              </label>
              <textarea
                value={form.memory_config}
                onChange={(e) => setForm({ ...form, memory_config: e.target.value })}
                rows={4}
                placeholder="填写长期记忆、上下文保留、摘要策略等内容"
                className={textareaCls}
                style={inputStyle}
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2 border-t pt-4" style={{ borderTopColor: "var(--th-card-border)" }}>
          <button
            onClick={onSave}
            disabled={saving || !canSave}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40"
          >
            {saving ? "保存中..." : isEdit ? "保存修改" : "新建员工"}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:bg-[var(--th-bg-surface-hover)]"
            style={{ border: "1px solid var(--th-input-border)", color: "var(--th-text-secondary)" }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

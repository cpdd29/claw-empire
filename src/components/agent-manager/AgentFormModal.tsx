import { useEffect, useRef, useState } from "react";
import type { Department, CliStatusMap } from "../../types";
import { localeName, useI18n } from "../../i18n";
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

export default function AgentFormModal({
  isKo,
  locale,
  tr,
  form,
  setForm,
  departments,
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
  departments: Department[];
  isEdit: boolean;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [cliStatus, setCliStatus] = useState<CliStatusMap | null>(null);
  const [deptError, setDeptError] = useState(false);

  useEffect(() => {
    getCliStatus().then(setCliStatus).catch(() => {});
  }, []);

  // ESC 键关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const inputCls =
    "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors";
  const inputStyle = {
    background: "var(--th-input-bg)",
    borderColor: "var(--th-input-border)",
    color: "var(--th-text-primary)",
  };

  // 已安装的 CLI 工具列表（始终包含 api 选项）
  const installedCli = Object.entries(cliStatus ?? {}).filter(
    ([, s]) => s.installed
  );

  const handleSave = () => {
    if (!form.department_id) {
      setDeptError(true);
      return;
    }
    setDeptError(false);
    onSave();
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
        {/* Modal header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={{ color: "var(--th-text-heading)" }}>
            {isEdit ? "编辑成员" : "招募新成员"}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--th-bg-surface-hover)] transition-colors"
            style={{ color: "var(--th-text-muted)" }}
          >
            ✕
          </button>
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-2 gap-5">
          {/* ── Left column: 基本信息 ── */}
          <div className="space-y-4">
            <div
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--th-text-muted)" }}
            >
              基本信息
            </div>
            {/* 名称 */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
                名称 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="DORO"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            {/* 多语言名称 */}
            {locale.startsWith("ko") && (
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
                  {tr("韩文名", "Korean Name")}
                </label>
                <input
                  type="text"
                  value={form.name_ko}
                  onChange={(e) => setForm({ ...form, name_ko: e.target.value })}
                  placeholder="도로롱"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            )}
            {locale.startsWith("ja") && (
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
                  {t({ ko: "일본어 이름", en: "Japanese Name", ja: "日本語名", zh: "日语名" })}
                </label>
                <input
                  type="text"
                  value={form.name_ja}
                  onChange={(e) => setForm({ ...form, name_ja: e.target.value })}
                  placeholder="ドロロン"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            )}
            {/* 所属部门 */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
                所属部门 <span className="text-red-400">*</span>
              </label>
              <select
                value={form.department_id}
                onChange={(e) => {
                  setForm({ ...form, department_id: e.target.value });
                  if (e.target.value) setDeptError(false);
                }}
                className={`${inputCls} cursor-pointer`}
                style={{
                  ...inputStyle,
                  ...(deptError ? { borderColor: "#f87171" } : {}),
                }}
              >
                <option value="">— 未分配 —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.icon} {localeName(locale, d)}
                  </option>
                ))}
              </select>
              {deptError && (
                <p className="mt-1 text-xs text-red-400">请选择所属部门</p>
              )}
            </div>
          </div>

          {/* ── Right column: 角色配置 ── */}
          <div className="space-y-4">
            <div
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--th-text-muted)" }}
            >
              角色配置
            </div>
            {/* 角色 */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
                角色 <span className="text-red-400">*</span>
              </label>
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: Number(e.target.value) as 0 | 1 | 2 | 3 })}
                className={`${inputCls} cursor-pointer`}
                style={inputStyle}
              >
                <option value={0}>SuperCEO</option>
                <option value={1}>秘书</option>
                <option value={2}>组长</option>
                <option value={3}>员工</option>
              </select>
            </div>
            {/* Agent配置 */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
                Agent配置 <span className="text-red-400">*</span>
              </label>
              <select
                value={form.cli_provider}
                onChange={(e) => setForm({ ...form, cli_provider: e.target.value as any })}
                className={`${inputCls} cursor-pointer`}
                style={inputStyle}
              >
                {cliStatus === null ? (
                  <option value={form.cli_provider}>{CLI_LABEL[form.cli_provider] ?? form.cli_provider}</option>
                ) : (
                  <>
                    {installedCli.map(([key]) => (
                      <option key={key} value={key}>
                        {CLI_LABEL[key] ?? key}
                      </option>
                    ))}
                    <option value="api">{CLI_LABEL["api"]}</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* 人物属性 — 横跨全宽 */}
        <div className="w-full mt-4">
          <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
            人物属性 (soul.md) <span className="text-red-400">*</span>
          </label>
          <textarea
            value={form.personality}
            onChange={(e) => setForm({ ...form, personality: e.target.value })}
            rows={3}
            placeholder="描述角色的专业领域、性格特征..."
            className={`${inputCls} resize-none`}
            style={inputStyle}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-5 pt-4" style={{ borderTop: "1px solid var(--th-card-border)" }}>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.personality.trim()}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white disabled:opacity-40 shadow-sm shadow-blue-600/20"
          >
            {saving ? "保存中..." : isEdit ? "保存修改" : "确认招募"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-[var(--th-bg-surface-hover)]"
            style={{ border: "1px solid var(--th-input-border)", color: "var(--th-text-secondary)" }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

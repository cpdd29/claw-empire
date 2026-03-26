import { useEffect, useMemo, useRef, useState } from "react";
import type { Agent, Department, Office, WorkflowPackKey } from "../../types";
import { localeName, useI18n } from "../../i18n";
import * as api from "../../api";
import { DEPT_BLANK } from "./constants";
import EmojiPicker from "./EmojiPicker";
import type { DeptForm, Translator } from "./types";

export default function DepartmentFormModal({
  locale,
  tr,
  department,
  departments,
  offices,
  agents,
  scopedOfficeId,
  onSave,
  onClose,
  onSaveDepartment,
  onDeleteDepartment,
  workflowPackKey,
}: {
  locale: string;
  tr: Translator;
  department: Department | null;
  departments: Department[];
  offices: Office[];
  agents: Agent[];
  scopedOfficeId?: string | null;
  onSave: () => void | Promise<void>;
  onClose: () => void;
  onSaveDepartment?: (input: {
    mode: "create" | "update";
    id: string;
    leaderAgentId: string;
    payload: {
      name: string;
      name_ko: string;
      name_ja: string | null;
      name_zh: string | null;
      office_id: string | null;
      icon: string;
      description: string | null;
      prompt: string | null;
      sort_order: number;
    };
  }) => Promise<void>;
  onDeleteDepartment?: (departmentId: string) => Promise<void>;
  workflowPackKey?: WorkflowPackKey;
}) {
  const { t } = useI18n();
  const isEdit = !!department;
  const [form, setForm] = useState<DeptForm>(() => {
    if (department) {
      return {
        id: department.id,
        name: department.name,
        name_ko: department.name_ko || "",
        name_ja: department.name_ja || "",
        name_zh: department.name_zh || "",
        office_id: department.office_id || scopedOfficeId || "",
        icon: department.icon,
        description: department.description || "",
        prompt: department.prompt || "",
      };
    }
    return { ...DEPT_BLANK, office_id: scopedOfficeId || "" };
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [leaderError, setLeaderError] = useState(false);
  const [officeError, setOfficeError] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const currentLeaderAgentId = useMemo(
    () => (department ? agents.find((agent) => agent.department_id === department.id && agent.role === "team_leader")?.id ?? "" : ""),
    [agents, department],
  );
  const [leaderAgentId, setLeaderAgentId] = useState(currentLeaderAgentId);

  // 基于 sort_order 计算下一个排序值
  const nextSortOrder = (() => {
    const orders = departments.map((d) => d.sort_order).filter((n) => typeof n === "number" && !isNaN(n));
    return Math.max(0, ...orders) + 1;
  })();
  const departmentMemberAgents = useMemo(
    () => (department ? agents.filter((agent) => agent.department_id === department.id) : []),
    [agents, department],
  );
  const leaderSourceAgents = useMemo(
    () => (departmentMemberAgents.length > 0 ? departmentMemberAgents : agents),
    [agents, departmentMemberAgents],
  );
  const leaderOptions = useMemo(
    () =>
      leaderSourceAgents.map((agent) => {
        const currentDepartment = departments.find((item) => item.id === agent.department_id);
        return {
          value: agent.id,
          label: localeName(locale, agent),
          helper: currentDepartment
            ? `${tr("当前部门", "Current Department")}: ${localeName(locale, currentDepartment)}`
            : tr("当前未分配部门", "Currently unassigned"),
        };
      }),
    [departments, leaderSourceAgents, locale, tr],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    setLeaderAgentId(currentLeaderAgentId);
    setLeaderError(false);
  }, [currentLeaderAgentId]);

  useEffect(() => {
    setForm((current) => {
      if (department) {
        return {
          id: department.id,
          name: department.name,
          name_ko: department.name_ko || "",
          name_ja: department.name_ja || "",
          name_zh: department.name_zh || "",
          office_id: department.office_id || scopedOfficeId || "",
          icon: department.icon,
          description: department.description || "",
          prompt: department.prompt || "",
        };
      }
      return { ...DEPT_BLANK, office_id: scopedOfficeId || "" };
    });
    setOfficeError(false);
  }, [department, scopedOfficeId]);

  const syncDepartmentLeader = async (departmentId: string, nextLeaderAgentId: string) => {
    const nextLeader = agents.find((agent) => agent.id === nextLeaderAgentId);
    if (!nextLeader) {
      throw new Error(`leader agent not found: ${nextLeaderAgentId}`);
    }

    const updates: Promise<unknown>[] = [];
    for (const agent of agents) {
      if (agent.department_id === departmentId && agent.id !== nextLeaderAgentId && agent.role === "team_leader") {
        updates.push(api.updateAgent(agent.id, { role: "senior" }));
      }
    }

    const nextLeaderPayload: Partial<Pick<Agent, "department_id" | "role">> = {};
    if (nextLeader.department_id !== departmentId) {
      nextLeaderPayload.department_id = departmentId;
    }
    if (nextLeader.role !== "team_leader") {
      nextLeaderPayload.role = "team_leader";
    }
    if (Object.keys(nextLeaderPayload).length > 0) {
      updates.push(api.updateAgent(nextLeader.id, nextLeaderPayload));
    }

    await Promise.all(updates);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (!form.office_id) {
      setOfficeError(true);
      return;
    }
    if (!leaderAgentId) {
      setLeaderError(true);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        name_ko: form.name_ko.trim(),
        name_ja: form.name_ja.trim() || null,
        name_zh: form.name_zh.trim() || null,
        office_id: form.office_id || null,
        icon: form.icon,
        description: form.description.trim() || null,
        prompt: form.prompt.trim() || null,
        sort_order: department?.sort_order ?? nextSortOrder,
      };
      if (isEdit) {
        if (onSaveDepartment) {
          await onSaveDepartment({
            mode: "update",
            id: department!.id,
            leaderAgentId,
            payload: { ...payload, sort_order: department!.sort_order },
          });
        } else {
          await api.updateDepartment(department!.id, {
            name: payload.name,
            name_ko: payload.name_ko,
            name_ja: payload.name_ja,
            name_zh: payload.name_zh,
            office_id: payload.office_id,
            icon: payload.icon,
            description: payload.description,
            prompt: payload.prompt,
            workflow_pack_key: workflowPackKey,
          });
          await syncDepartmentLeader(department!.id, leaderAgentId);
        }
      } else {
        // 根据名称生成 slug，如果全是非拉丁字符则回退为 dept-N
        const slug = form.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        let deptId = slug || `dept-${nextSortOrder}`;
        // 与现有 ID 冲突时追加数字后缀
        const existingIds = new Set(departments.map((d) => d.id));
        let suffix = 2;
        while (existingIds.has(deptId)) {
          deptId = `${slug || "dept"}-${suffix++}`;
        }
        if (onSaveDepartment) {
          await onSaveDepartment({
            mode: "create",
            id: deptId,
            leaderAgentId,
            payload: { ...payload, sort_order: nextSortOrder },
          });
        } else {
          await api.createDepartment({
            id: deptId,
            name: payload.name,
            name_ko: payload.name_ko,
            name_ja: payload.name_ja ?? "",
            name_zh: payload.name_zh ?? "",
            office_id: payload.office_id,
            icon: payload.icon,
            description: payload.description ?? undefined,
            prompt: payload.prompt ?? undefined,
            workflow_pack_key: workflowPackKey,
          });
          await syncDepartmentLeader(deptId, leaderAgentId);
        }
      }
      await onSave();
      onClose();
    } catch (e: any) {
      console.error("Dept save failed:", e);
      if (api.isApiRequestError(e) && e.code === "department_id_exists") {
        alert(tr("部门 ID 已存在。", "Department ID already exists."));
      } else if (api.isApiRequestError(e) && e.code === "sort_order_conflict") {
        alert(
          tr(
            "部门排序冲突，请稍后重试。",
            "Department sort order conflict. Please retry.",
          ),
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      if (onDeleteDepartment) {
        await onDeleteDepartment(department!.id);
      } else {
        await api.deleteDepartment(department!.id, { workflowPackKey });
      }
      onSave();
      onClose();
    } catch (e: any) {
      console.error("Dept delete failed:", e);
      if (api.isApiRequestError(e) && e.code === "department_has_employees") {
        alert(tr("该部门下还有员工，不可删除", "Cannot delete: department still has employees."));
      } else if (api.isApiRequestError(e) && e.code === "department_has_tasks") {
        alert(tr("该部门仍有关联任务，无法删除。", "Cannot delete: department has tasks."));
      } else if (api.isApiRequestError(e) && e.code === "department_protected") {
        alert(tr("系统保护部门无法删除。", "Cannot delete: protected system department."));
      }
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors";
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
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto"
        style={{
          background: "var(--th-card-bg)",
          border: "1px solid var(--th-card-border)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--th-text-heading)" }}>
            <span className="text-lg">{form.icon}</span>
            {isEdit ? tr("编辑部门", "Edit Department") : tr("新建部门", "Add Department")}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--th-bg-surface-hover)] transition-colors"
            style={{ color: "var(--th-text-muted)" }}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* 图标 + 英文名称 */}
          <div className="flex items-start gap-3">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
                {tr("图标", "Icon")}
              </label>
              <EmojiPicker tr={tr} value={form.icon} onChange={(emoji) => setForm({ ...form, icon: emoji })} />
            </div>
            <div className="flex-1">
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
                {tr("部门名称", "Department Name")} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={tr("请输入部门名称", "Enter department name")}
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
              {tr("所属办公室", "Office")} <span className="text-red-400">*</span>
            </label>
            <select
              value={form.office_id}
              onChange={(e) => {
                setForm({ ...form, office_id: e.target.value });
                if (e.target.value) setOfficeError(false);
              }}
              className={`${inputCls} cursor-pointer`}
              style={{
                ...inputStyle,
                ...(officeError ? { borderColor: "#f87171" } : {}),
              }}
            >
              <option value="">{tr("请选择办公室", "Select an office")}</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.icon} {localeName(locale, office)}
                </option>
              ))}
            </select>
            {officeError && <p className="mt-1 text-xs text-red-400">{tr("请选择办公室", "Please select an office")}</p>}
          </div>

          {/* 多语言名称 */}
          {locale.startsWith("ko") && (
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
                {tr("本地兼容名称", "Korean Name")}
              </label>
              <input
                type="text"
                value={form.name_ko}
                onChange={(e) => setForm({ ...form, name_ko: e.target.value })}
                placeholder="开发组"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          )}
          {locale.startsWith("ja") && (
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
                {t({ ko: "日语名称", en: "Japanese Name", ja: "日本語名", zh: "日语名" })}
              </label>
              <input
                type="text"
                value={form.name_ja}
                onChange={(e) => setForm({ ...form, name_ja: e.target.value })}
                placeholder="開発チーム"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          )}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
              {tr("部长", "Department Leader")} <span className="text-red-400">*</span>
            </label>
            <select
              value={leaderAgentId}
              onChange={(e) => {
                setLeaderAgentId(e.target.value);
                if (e.target.value) setLeaderError(false);
              }}
              className={`${inputCls} cursor-pointer`}
              style={{
                ...inputStyle,
                ...(leaderError ? { borderColor: "#f87171" } : {}),
              }}
            >
              <option value="">{tr("请选择部长", "Select a department leader")}</option>
              {leaderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {leaderOptions.length > 0 && leaderAgentId && (
              <p className="mt-1 text-xs" style={{ color: "var(--th-text-muted)" }}>
                {leaderOptions.find((option) => option.value === leaderAgentId)?.helper}
              </p>
            )}
            {departmentMemberAgents.length === 0 && (
              <p className="mt-1 text-xs" style={{ color: "var(--th-text-muted)" }}>
                {tr(
                  "当前部门暂无成员，保存后会将所选成员设为该部门唯一部长。",
                  "The selected member will become the only leader for this department after save.",
                )}
              </p>
            )}
            {leaderError && <p className="mt-1 text-xs text-red-400">{tr("请选择部长", "Please select a leader")}</p>}
          </div>

          {/* 说明 */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
              {tr("部门说明", "Description")}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              placeholder={tr("简要说明部门职责", "Brief description of the department")}
              className={`${inputCls} resize-none`}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-5 pt-4" style={{ borderTop: "1px solid var(--th-card-border)" }}>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.office_id}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white disabled:opacity-40 shadow-sm shadow-blue-600/20"
          >
            {saving
              ? tr("保存中...", "Saving...")
              : isEdit
                ? tr("保存修改", "Save Changes")
                : tr("新建部门", "Add Department")}
          </button>
          {isEdit &&
            (confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-3 py-2.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 transition-colors"
                >
                  {tr("确认删除", "Confirm")}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-2.5 rounded-lg text-xs transition-colors"
                  style={{ color: "var(--th-text-muted)" }}
                >
                  {tr("取消", "No")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-red-500/15 hover:text-red-400"
                style={{ border: "1px solid var(--th-input-border)", color: "var(--th-text-muted)" }}
              >
                {tr("删除", "Delete")}
              </button>
            ))}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-[var(--th-bg-surface-hover)]"
            style={{ border: "1px solid var(--th-input-border)", color: "var(--th-text-secondary)" }}
          >
            {tr("取消", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

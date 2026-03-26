import { useEffect, useRef, useState } from "react";
import type { Office } from "../../types";
import { patch, post } from "../../api/core";
import EmojiPicker from "./EmojiPicker";
import type { Translator } from "./types";

interface OfficeForm {
  name: string;
  icon: string;
  description: string;
  secretaryNodeId: string;
}

const BLANK: OfficeForm = {
  name: "",
  icon: "🏢",
  description: "",
  secretaryNodeId: "",
};

export interface OfficeSecretaryOption {
  value: string;
  label: string;
  helper?: string;
}

export default function OfficeFormModal({
  tr,
  office,
  secretaryOptions,
  initialSecretaryNodeId,
  onSave,
  onDelete,
  onClose,
}: {
  tr: Translator;
  office: Office | null;
  secretaryOptions: OfficeSecretaryOption[];
  initialSecretaryNodeId?: string | null;
  onSave: (savedOffice: Office, secretaryNodeId: string | null) => Promise<void> | void;
  onDelete?: (office: Office, secretaryNodeId: string | null) => Promise<void> | void;
  onClose: () => void;
}) {
  const isEdit = !!office;
  const [form, setForm] = useState<OfficeForm>(() =>
    office
      ? {
          name: office.name,
          icon: office.icon,
          description: office.description || "",
          secretaryNodeId: initialSecretaryNodeId || "",
        }
      : { ...BLANK },
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [secretaryError, setSecretaryError] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextNameError = !form.name.trim();
    const nextSecretaryError = !form.secretaryNodeId;
    setNameError(nextNameError);
    setSecretaryError(nextSecretaryError);
    if (nextNameError || nextSecretaryError) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        name_ko: form.name.trim(),
        name_ja: null,
        name_zh: form.name.trim(),
        icon: form.icon,
        description: form.description.trim() || null,
      };
      let savedOffice: Office;
      if (isEdit && office) {
        savedOffice = await patch<Office>(`/api/offices/${office.id}`, payload);
      } else {
        savedOffice = await post<Office>("/api/offices", payload);
      }
      await onSave(savedOffice, form.secretaryNodeId || null);
      onClose();
    } catch (err) {
      console.error("Save office failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!office) return;
    setSaving(true);
    try {
      await onDelete?.(office, form.secretaryNodeId || null);
      onClose();
    } catch (err) {
      console.error("Delete office failed:", err);
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
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
      >
        <h2 className="text-lg font-bold" style={{ color: "var(--th-text-heading)" }}>
          {isEdit ? tr("编辑办公室", "Edit Office") : tr("新建办公室", "Add Office")}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Icon + Name */}
          <div className="flex items-start gap-3">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "var(--th-text-muted)" }}>
                {tr("图标", "Icon")}
              </label>
              <EmojiPicker tr={tr} value={form.icon} onChange={(icon) => setForm((f) => ({ ...f, icon }))} />
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--th-text-muted)" }}>
                <span className="mr-1 text-red-400">*</span>
                {tr("名称", "Name")}
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setForm((f) => ({ ...f, name: nextValue }));
                  if (nextValue.trim()) setNameError(false);
                }}
                className={inputCls}
                style={{
                  ...inputStyle,
                  ...(nameError ? { borderColor: "#f87171" } : {}),
                }}
                placeholder="办公室名称"
              />
              {nameError && <p className="mt-1 text-xs text-red-400">{tr("请输入名称", "Please enter a name")}</p>}
            </div>
          </div>

          {/* Secretary */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--th-text-muted)" }}>
              <span className="mr-1 text-red-400">*</span>
              {tr("负责人", "Owner")}
            </label>
            <select
              value={form.secretaryNodeId}
              onChange={(e) => {
                const nextValue = e.target.value;
                setForm((f) => ({ ...f, secretaryNodeId: nextValue }));
                if (nextValue) setSecretaryError(false);
              }}
              className={`${inputCls} cursor-pointer`}
              style={{
                ...inputStyle,
                ...(secretaryError ? { borderColor: "#f87171" } : {}),
              }}
            >
              <option value="">{tr("请选择负责人", "Select an owner")}</option>
              {secretaryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {secretaryError && (
              <p className="mt-1 text-xs text-red-400">{tr("请选择负责人", "Please select an owner")}</p>
            )}
            {form.secretaryNodeId && (
              <p className="mt-1 text-[11px]" style={{ color: "var(--th-text-muted)" }}>
                {secretaryOptions.find((option) => option.value === form.secretaryNodeId)?.helper ||
                  tr("已绑定所选秘书节点", "Selected secretary node will be linked")}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--th-text-muted)" }}>
              {tr("说明", "Description")}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className={`${inputCls} resize-none`}
              style={inputStyle}
              placeholder={tr("办公室说明", "Office description")}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            {isEdit &&
              (confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="px-3 py-2.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
                  >
                    {tr("确认删除", "Confirm Delete")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-2.5 rounded-lg text-xs transition-colors"
                    style={{ color: "var(--th-text-muted)" }}
                  >
                    {tr("取消", "No")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-red-500/15 hover:text-red-400"
                  style={{ border: "1px solid var(--th-input-border)", color: "var(--th-text-muted)" }}
                >
                  {tr("删除", "Delete")}
                </button>
              ))}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-[var(--th-bg-surface-hover)]"
                style={{ border: "1px solid var(--th-input-border)", color: "var(--th-text-secondary)" }}
              >
                {tr("取消", "Cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
              >
                {saving ? tr("保存中...", "Saving...") : tr("保存", "Save")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

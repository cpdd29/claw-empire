import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { listWorkflows, createWorkflow, deleteWorkflow, type Workflow } from "../api/workflows";
import { getAgents } from "../api";
import WorkflowEditor from "./WorkflowEditor";

interface Agent {
  id: string;
  name: string;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function isRunnable(wf: Workflow): boolean {
  return !!wf.name?.trim() && !!wf.assigned_agent_id;
}

// ── 新建工作流表单（内嵌全屏页面） ──────────────────────────────────────────
interface NewWorkflowFormProps {
  agents: Agent[];
  usedAgentIds: Set<string>;
  onCancel: () => void;
  onCreated: (wf: Workflow) => void;
}

function NewWorkflowForm({ agents, usedAgentIds, onCancel, onCreated }: NewWorkflowFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [assigneeError, setAssigneeError] = useState(false);
  const [serverError, setServerError] = useState("");

  const canSave = name.trim().length > 0 && !!assigneeId;
  const availableAgents = agents.filter((a) => !usedAgentIds.has(a.id));

  const handleSave = async () => {
    if (!assigneeId) { setAssigneeError(true); return; }
    setSaving(true);
    setServerError("");
    try {
      const wf = await createWorkflow({
        name: name.trim() || t({ ko: "새 워크플로우", en: "New Workflow", ja: "新規ワークフロー", zh: "新建工作流" }),
        description: description.trim() || undefined,
        assigned_agent_id: assigneeId,
      });
      onCreated(wf);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setServerError(msg || t({ ko: "저장 실패", en: "Save failed", ja: "保存失敗", zh: "保存失败" }));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="text-white">
      {/* 顶部栏 */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700">
        <button
          onClick={onCancel}
          className="border border-slate-700 text-slate-300 hover:bg-slate-700 rounded-lg px-4 py-2 text-sm transition-colors"
        >
          ← {t({ ko: "취소", en: "Cancel", ja: "キャンセル", zh: "取消" })}
        </button>
        <h2 className="text-sm font-semibold text-white flex-1">
          {t({ ko: "새 워크플로우", en: "New Workflow", ja: "新規ワークフロー", zh: "新建工作流" })}
        </h2>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors"
        >
          {saving
            ? t({ ko: "저장 중...", en: "Saving...", ja: "保存中...", zh: "保存中..." })
            : t({ ko: "저장", en: "Save", ja: "保存", zh: "保存" })}
        </button>
      </div>

      {/* 表单内容 */}
      <div className="px-6 py-6">
        <div className="max-w-xl rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-4">
          {serverError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{serverError}</p>
          )}

          {/* 工作流名称 */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              {t({ ko: "워크플로우 이름", en: "Workflow Name", ja: "ワークフロー名", zh: "工作流名称" })}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t({ ko: "이름을 입력하세요", en: "Enter workflow name", ja: "名前を入力", zh: "请输入工作流名称" })}
              className={inputCls}
              autoFocus
            />
          </div>

          {/* 负责人（必填） */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              {t({ ko: "담당자", en: "Assignee", ja: "担当者", zh: "负责人" })}
              <span className="ml-1 text-red-400">*</span>
            </label>
            <select
              value={assigneeId}
              onChange={(e) => { setAssigneeId(e.target.value); setAssigneeError(false); }}
              className={`${inputCls} cursor-pointer ${assigneeError ? "border-red-500 ring-1 ring-red-500" : ""}`}
            >
              <option value="">{t({ ko: "담당자를 선택하세요", en: "Select assignee", ja: "担当者を選択", zh: "请选择负责人" })}</option>
              {availableAgents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {assigneeError && (
              <p className="mt-1 text-xs text-red-400">
                {t({ ko: "담당자를 선택해주세요", en: "Please select an assignee", ja: "担当者を選択してください", zh: "请选择负责人" })}
              </p>
            )}
            {availableAgents.length === 0 && (
              <p className="mt-1 text-xs text-amber-400">
                {t({ ko: "사용 가능한 담당자가 없습니다", en: "No available assignees", ja: "利用可能な担当者がいません", zh: "所有负责人已被其他工作流占用" })}
              </p>
            )}
          </div>

          {/* 描述（选填） */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              {t({ ko: "설명 (선택)", en: "Description (optional)", ja: "説明（任意）", zh: "描述（选填）" })}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={t({ ko: "워크플로우 설명", en: "Workflow description", ja: "ワークフローの説明", zh: "工作流描述" })}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WorkflowManager 主页面 ──────────────────────────────────────────────────
export default function WorkflowManager() {
  const { t } = useI18n();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "new">("list");
  const [editing, setEditing] = useState<Workflow | null>(null);

  const reload = () => {
    setLoading(true);
    listWorkflows()
      .then(setWorkflows)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    getAgents().then((list) => setAgents(list.map((a) => ({ id: a.id, name: a.name })))).catch(() => {});
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(t({ ko: "이 워크플로우를 삭제하시겠습니까?", en: "Delete this workflow?", ja: "このワークフローを削除しますか？", zh: "确认删除这个工作流？" }))) return;
    await deleteWorkflow(id);
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  };

  const handleCreated = (wf: Workflow) => {
    setWorkflows((prev) => [wf, ...prev]);
    setView("list");
    setEditing(wf); // 创建成功后直接进入编辑器
  };

  const handleSaved = (updated: Workflow) => {
    setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    setEditing(updated);
  };

  // 新建表单视图
  if (view === "new") {
    const usedAgentIds = new Set(workflows.map((w) => w.assigned_agent_id).filter(Boolean) as string[]);
    return (
      <NewWorkflowForm
        agents={agents}
        usedAgentIds={usedAgentIds}
        onCancel={() => setView("list")}
        onCreated={handleCreated}
      />
    );
  }

  // 编辑器视图
  if (editing) {
    const usedAgentIds = new Set(
      workflows
        .filter((w) => w.id !== editing.id)
        .map((w) => w.assigned_agent_id)
        .filter(Boolean) as string[]
    );
    return (
      <WorkflowEditor
        workflow={editing}
        onBack={() => { setEditing(null); reload(); }}
        onSaved={handleSaved}
        usedAgentIds={usedAgentIds}
      />
    );
  }

  // 列表视图
  return (
    <div className="flex flex-col gap-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">
            {t({ ko: "워크플로우", en: "Workflows", ja: "ワークフロー", zh: "工作流" })}
          </h2>
          <p className="text-xs mt-0.5 text-slate-400">
            {t({ ko: "시각적 워크플로우 편집기", en: "Visual workflow editor", ja: "ビジュアルワークフローエディタ", zh: "可视化工作流编辑器" })}
          </p>
        </div>
        <button
          onClick={() => setView("new")}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors"
        >
          + {t({ ko: "새 워크플로우", en: "New Workflow", ja: "新規ワークフロー", zh: "新建工作流" })}
        </button>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="text-sm text-slate-400">
          {t({ ko: "불러오는 중...", en: "Loading...", ja: "読み込み中...", zh: "加载中..." })}
        </div>
      ) : workflows.length === 0 ? (
        <div className="rounded-xl p-12 flex flex-col items-center gap-3 bg-slate-800 border border-slate-700">
          <span className="text-4xl">⚡</span>
          <p className="text-sm text-slate-400">
            {t({ ko: "워크플로우가 없습니다. 새로 만들어보세요.", en: "No workflows yet. Create one to get started.", ja: "ワークフローがありません。作成してください。", zh: "还没有工作流，点击「新建工作流」开始" })}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {workflows.map((wf) => {
            const runnable = isRunnable(wf);
            const assigneeName = agents.find((a) => a.id === wf.assigned_agent_id)?.name;
            return (
              <div
                key={wf.id}
                onClick={() => setEditing(wf)}
                className="group rounded-xl border border-slate-700 bg-slate-800 p-3.5 cursor-pointer hover:border-slate-500 hover:shadow-lg hover:shadow-black/20 transition-all"
              >
                {/* 名称 + 状态标签 */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-semibold text-sm text-white truncate flex-1">{wf.name}</span>
                  <span
                    className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${
                      runnable
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-slate-500/15 text-slate-400 border-slate-500/30"
                    }`}
                  >
                    {runnable
                      ? t({ ko: "실행 가능", en: "Runnable", ja: "実行可能", zh: "可运行" })
                      : t({ ko: "초안", en: "Draft", ja: "下書き", zh: "草稿" })}
                  </span>
                </div>

                {/* 负责人 */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-slate-500 text-[11px]">
                    {t({ ko: "담당자", en: "Assignee", ja: "担当者", zh: "负责人" })}:
                  </span>
                  <span className="text-[11px] text-slate-300">
                    {assigneeName ?? t({ ko: "미설정", en: "Unassigned", ja: "未設定", zh: "未设置" })}
                  </span>
                </div>

                {/* 运行次数 */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-slate-500 text-[11px]">
                    {t({ ko: "실행 횟수", en: "Runs", ja: "実行回数", zh: "运行次数" })}:
                  </span>
                  <span className="text-[11px] text-slate-300">{wf.run_count ?? 0}</span>
                </div>

                {/* 底部：时间 + 删除 */}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-700">
                  <span className="text-[10px] text-slate-500">{formatDate(wf.updated_at)}</span>
                  <button
                    onClick={(e) => handleDelete(e, wf.id)}
                    className="text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:bg-red-500/10"
                  >
                    {t({ ko: "삭제", en: "Delete", ja: "削除", zh: "删除" })}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

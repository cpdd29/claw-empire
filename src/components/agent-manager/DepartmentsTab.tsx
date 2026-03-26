import type { DragEvent } from "react";
import type { Agent, Department } from "../../types";
import { localeName } from "../../i18n";
import type { Translator } from "./types";

interface DepartmentsTabProps {
  tr: Translator;
  locale: string;
  agents: Agent[];
  departments: Department[];
  deptOrder: Department[];
  deptOrderDirty: boolean;
  reorderSaving: boolean;
  draggingDeptId: string | null;
  dragOverDeptId: string | null;
  dragOverPosition: "before" | "after" | null;
  onSaveOrder: () => void;
  onCancelOrder: () => void;
  onMoveDept: (index: number, direction: -1 | 1) => void;
  onEditDept: (department: Department) => void;
  onDeleteDept: (department: Department) => void;
  onDragStart: (deptId: string, event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (deptId: string, event: DragEvent<HTMLDivElement>) => void;
  onDrop: (deptId: string, event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

export default function DepartmentsTab({
  tr,
  locale,
  agents,
  deptOrder,
  deptOrderDirty,
  reorderSaving,
  draggingDeptId,
  dragOverDeptId,
  dragOverPosition,
  onSaveOrder,
  onCancelOrder,
  onMoveDept,
  onEditDept,
  onDeleteDept,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: DepartmentsTabProps) {
  return (
    <div className="space-y-4">
      {deptOrderDirty && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)" }}
        >
          <span className="text-sm" style={{ color: "var(--th-text-primary)" }}>
            {tr("排序已变更。", "Order has been changed.")}
          </span>
          <button
            onClick={onSaveOrder}
            disabled={reorderSaving}
            className="ml-auto px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-all"
          >
            {reorderSaving ? tr("保存中...", "Saving...") : tr("保存排序", "Save Order")}
          </button>
          <button
            onClick={onCancelOrder}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:bg-white/5"
            style={{ color: "var(--th-text-muted)" }}
          >
            {tr("取消", "Cancel")}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {deptOrder.map((dept, index) => {
          const agentCountForDept = agents.filter((agent) => agent.department_id === dept.id).length;
          const leader = agents.find((agent) => agent.department_id === dept.id && agent.role === "team_leader") ?? null;
          const isDragging = draggingDeptId === dept.id;
          const isDragTarget = dragOverDeptId === dept.id && draggingDeptId !== dept.id;
          const showDropBefore = isDragTarget && dragOverPosition === "before";
          const showDropAfter = isDragTarget && dragOverPosition === "after";
          return (
            <div
              key={dept.id}
              draggable
              onDragStart={(e) => onDragStart(dept.id, e)}
              onDragOver={(e) => onDragOver(dept.id, e)}
              onDrop={(e) => onDrop(dept.id, e)}
              onDragEnd={onDragEnd}
              className={`relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:shadow-md group ${isDragging ? "opacity-60" : ""}`}
              style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
            >
              {showDropBefore && (
                <div className="pointer-events-none absolute left-2 right-2 top-0 h-0.5 rounded bg-blue-400" />
              )}
              {showDropAfter && (
                <div className="pointer-events-none absolute left-2 right-2 bottom-0 h-0.5 rounded bg-blue-400" />
              )}

              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => onMoveDept(index, -1)}
                  disabled={index === 0}
                  className="w-6 h-5 flex items-center justify-center rounded text-xs transition-all hover:bg-white/10 disabled:opacity-20"
                  style={{ color: "var(--th-text-muted)" }}
                >
                  ▲
                </button>
                <button
                  onClick={() => onMoveDept(index, 1)}
                  disabled={index === deptOrder.length - 1}
                  className="w-6 h-5 flex items-center justify-center rounded text-xs transition-all hover:bg-white/10 disabled:opacity-20"
                  style={{ color: "var(--th-text-muted)" }}
                >
                  ▼
                </button>
              </div>

              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ background: "var(--th-bg-surface)", color: "var(--th-text-secondary)" }}
              >
                {index + 1}
              </div>

              <span className="text-2xl">{dept.icon}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm" style={{ color: "var(--th-text-heading)" }}>
                    {dept.name}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "var(--th-bg-surface)", color: "var(--th-text-secondary)" }}
                  >
                    {agentCountForDept} {tr("人", "agents")}
                  </span>
                </div>
                {dept.description && (
                  <div className="text-xs mt-0.5 truncate" style={{ color: "var(--th-text-muted)" }}>
                    {dept.description}
                  </div>
                )}
                <div className="text-xs mt-1" style={{ color: "var(--th-text-muted)" }}>
                  {tr("部长", "Leader")}:{" "}
                  <span style={{ color: "var(--th-text-secondary)" }}>
                    {leader ? localeName(locale, leader) : tr("未绑定", "Unassigned")}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onEditDept(dept)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100 hover:bg-white/10"
                style={{ color: "var(--th-text-muted)" }}
              >
                {tr("编辑", "Edit")}
              </button>
              <button
                onClick={() => onDeleteDept(dept)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-400"
                style={{ color: "var(--th-text-muted)" }}
              >
                {tr("删除", "Delete")}
              </button>
            </div>
          );
        })}
      </div>

      {deptOrder.length === 0 && (
        <div className="text-center py-16" style={{ color: "var(--th-text-muted)" }}>
          <div className="text-3xl mb-2">🏢</div>
          {tr("暂无已创建部门。", "No departments found.")}
        </div>
      )}
    </div>
  );
}

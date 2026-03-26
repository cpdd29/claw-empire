import type { KeyboardEvent, RefObject } from "react";
import type { Agent, Department, Project } from "../../../types";
import AgentSelect from "../../AgentSelect";
import {
  TASK_TYPE_OPTIONS,
  priorityIcon,
  priorityLabel,
  taskTypeLabel,
  type MissingPathPrompt,
  type TFunction,
} from "../constants";

interface PrioritySectionProps {
  priority: number;
  t: TFunction;
  onPriorityChange: (priority: number) => void;
}

export function PrioritySection({ priority, t, onPriorityChange }: PrioritySectionProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        {t({ ko: "优先级", en: "Priority", ja: "優先度", zh: "优先级" })}: {priorityIcon(priority)}{" "}
        {priorityLabel(priority, t)} ({priority}/5)
      </label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onPriorityChange(star)}
            className={`flex-1 rounded-lg py-2 text-lg transition ${
              star <= priority ? "bg-amber-600 text-white shadow-md" : "bg-slate-800 text-slate-500 hover:bg-slate-700"
            }`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

interface AssigneeSectionProps {
  agents: Agent[];
  departments: Department[];
  departmentId: string;
  assignAgentId: string;
  t: TFunction;
  disabled?: boolean;
  onAssignAgentChange: (agentId: string) => void;
}

export function AssigneeSection({
  agents,
  departments,
  departmentId,
  assignAgentId,
  t,
  disabled,
  onAssignAgentChange,
}: AssigneeSectionProps) {
  return (
    <div className={disabled ? "pointer-events-none opacity-50" : ""}>
      <label className="mb-1 block text-sm font-medium text-slate-300">
        {t({ ko: "负责人", en: "Assignee", ja: "担当エージェント", zh: "负责人" })}
      </label>
      <AgentSelect
        agents={agents}
        departments={departments}
        value={assignAgentId}
        onChange={(value) => onAssignAgentChange(value)}
        placeholder={t({
          ko: "-- 未分配 --",
          en: "-- Unassigned --",
          ja: "-- 未割り当て --",
          zh: "-- 未分配 --",
        })}
        size="md"
      />
      {departmentId && agents.length === 0 && (
        <p className="mt-1 text-xs text-slate-500">
          {t({
            ko: "该部门暂无可用代理。",
            en: "No agents are available in this department.",
            ja: "この部署にはエージェントがいません。",
            zh: "该部门暂无可用代理。",
          })}
        </p>
      )}
    </div>
  );
}

interface ProjectSectionProps {
  t: TFunction;
  projectPickerRef: RefObject<HTMLDivElement | null>;
  projectQuery: string;
  projectDropdownOpen: boolean;
  projectActiveIndex: number;
  projectsLoading: boolean;
  filteredProjects: Project[];
  selectedProject: Project | null;
  projects: Project[];
  createNewProjectMode: boolean;
  newProjectPath: string;
  pathApiUnsupported: boolean;
  pathSuggestionsOpen: boolean;
  pathSuggestionsLoading: boolean;
  pathSuggestions: string[];
  missingPathPrompt: MissingPathPrompt | null;
  nativePathPicking: boolean;
  nativePickerUnsupported: boolean;
  onProjectQueryChange: (value: string) => void;
  onProjectInputFocus: () => void;
  onProjectInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onToggleProjectDropdown: () => void;
  onSelectProject: (project: Project | null) => void;
  onProjectHover: (projectId: string) => void;
  onEnableCreateNewProject: () => void;
  onNewProjectPathChange: (value: string) => void;
  onOpenManualPathBrowser: () => void;
  onTogglePathSuggestions: () => void;
  onPickNativePath: () => void;
  onSelectPathSuggestion: (path: string) => void;
}

export function ProjectSection({
  t,
  projectPickerRef,
  projectQuery,
  projectDropdownOpen,
  projectActiveIndex,
  projectsLoading,
  filteredProjects,
  selectedProject,
  projects,
  createNewProjectMode,
  newProjectPath,
  pathApiUnsupported,
  pathSuggestionsOpen,
  pathSuggestionsLoading,
  pathSuggestions,
  missingPathPrompt,
  nativePathPicking,
  nativePickerUnsupported,
  onProjectQueryChange,
  onProjectInputFocus,
  onProjectInputKeyDown,
  onToggleProjectDropdown,
  onSelectProject,
  onProjectHover,
  onEnableCreateNewProject,
  onNewProjectPathChange,
  onOpenManualPathBrowser,
  onTogglePathSuggestions,
  onPickNativePath,
  onSelectPathSuggestion,
}: ProjectSectionProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-300">
        {t({ ko: "项目路径", en: "Project Path", ja: "プロジェクトパス", zh: "项目路径" })} <span className="text-red-400">*</span>
      </label>
      <div className="relative" ref={projectPickerRef}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={projectQuery}
            onChange={(event) => onProjectQueryChange(event.target.value)}
            onFocus={onProjectInputFocus}
            onKeyDown={onProjectInputKeyDown}
            placeholder={t({
              ko: "输入项目名称或路径",
              en: "Type project name or path",
              ja: "プロジェクト名またはパスを入力",
              zh: "输入项目名称或路径",
            })}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={onToggleProjectDropdown}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs text-slate-300 transition hover:bg-slate-700 hover:text-white"
            title={t({
              ko: "切换项目列表",
              en: "Toggle project list",
              ja: "プロジェクト一覧の切替",
              zh: "切换项目列表",
            })}
          >
            {projectDropdownOpen ? "▲" : "▼"}
          </button>
        </div>

        {projectDropdownOpen && (
          <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelectProject(null);
              }}
              className="w-full border-b border-slate-800 px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800"
            >
              {t({
                ko: "-- 无项目 --",
                en: "-- No project --",
                ja: "-- プロジェクトなし --",
                zh: "-- 无项目 --",
              })}
            </button>
            {projectsLoading ? (
              <div className="px-3 py-2 text-sm text-slate-400">
                {t({
                  ko: "正在加载项目...",
                  en: "Loading projects...",
                  ja: "プロジェクトを読み込み中...",
                  zh: "正在加载项目...",
                })}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-300">
                <p className="pr-2">
                  {t({
                    ko: "要创建为新项目吗？",
                    en: "Create as a new project?",
                    ja: "新規プロジェクトとして作成しますか？",
                    zh: "要创建为新项目吗？",
                  })}
                </p>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onEnableCreateNewProject();
                  }}
                  className="ml-auto shrink-0 rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                >
                  {t({ ko: "是", en: "Yes", ja: "はい", zh: "是" })}
                </button>
              </div>
            ) : (
              filteredProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onSelectProject(project);
                  }}
                  onMouseEnter={() => onProjectHover(project.id)}
                  className={`w-full px-3 py-2 text-left transition hover:bg-slate-800 ${
                    projectActiveIndex >= 0 && filteredProjects[projectActiveIndex]?.id === project.id
                      ? "bg-slate-700/90"
                      : selectedProject?.id === project.id
                        ? "bg-slate-800/80"
                        : ""
                  }`}
                >
                  <div className="truncate text-sm text-slate-100">{project.name}</div>
                  <div className="truncate text-[11px] text-slate-400">{project.project_path}</div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {selectedProject && <p className="mt-1 break-all text-xs text-slate-400">{selectedProject.project_path}</p>}

      {createNewProjectMode && !selectedProject && (
        <div className="mt-2 space-y-2">
          <label className="block text-xs text-slate-400">
            {t({
              ko: "新项目路径",
              en: "New project path",
              ja: "新規プロジェクトパス",
              zh: "新项目路径",
            })}
          </label>
          <input
            type="text"
            value={newProjectPath}
            onChange={(event) => onNewProjectPathChange(event.target.value)}
            placeholder="/absolute/path/to/project"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={pathApiUnsupported}
              onClick={onOpenManualPathBrowser}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t({
                ko: "应用内文件夹浏览",
                en: "In-App Folder Browser",
                ja: "アプリ内フォルダ閲覧",
                zh: "应用内文件夹浏览",
              })}
            </button>
            <button
              type="button"
              disabled={pathApiUnsupported}
              onClick={onTogglePathSuggestions}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pathSuggestionsOpen
                ? t({
                    ko: "关闭自动查找",
                    en: "Close Auto Finder",
                    ja: "自動候補を閉じる",
                    zh: "关闭自动查找",
                  })
                : t({ ko: "自动路径查找", en: "Auto Path Finder", ja: "自動パス検索", zh: "自动路径查找" })}
            </button>
            <button
              type="button"
              disabled={nativePathPicking}
              onClick={onPickNativePath}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {nativePathPicking
                ? t({
                    ko: "正在打开手动路径选择...",
                    en: "Opening Manual Picker...",
                    ja: "手動パス選択を開いています...",
                    zh: "正在打开手动路径选择...",
                  })
                : nativePickerUnsupported
                  ? t({
                      ko: "手动路径选择（不可用）",
                      en: "Manual Path Finder (Unavailable)",
                      ja: "手動パス選択（利用不可）",
                      zh: "手动路径选择（不可用）",
                    })
                  : t({
                      ko: "手动路径选择",
                      en: "Manual Path Finder",
                      ja: "手動パス選択",
                      zh: "手动路径选择",
                    })}
            </button>
          </div>
          {pathSuggestionsOpen && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/70">
              {pathSuggestionsLoading ? (
                <p className="px-3 py-2 text-xs text-slate-400">
                  {t({
                    ko: "正在加载路径候选...",
                    en: "Loading path suggestions...",
                    ja: "パス候補を読み込み中...",
                    zh: "正在加载路径候选...",
                  })}
                </p>
              ) : pathSuggestions.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">
                  {t({
                    ko: "没有推荐路径，请手动输入。",
                    en: "No suggested path. Enter one manually.",
                    ja: "候補パスがありません。手入力してください。",
                    zh: "没有推荐路径，请手动输入。",
                  })}
                </p>
              ) : (
                pathSuggestions.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => onSelectPathSuggestion(candidate)}
                    className="w-full px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-700/70"
                  >
                    {candidate}
                  </button>
                ))
              )}
            </div>
          )}
          {missingPathPrompt && (
            <p className="text-xs text-amber-300">
              {t({
                ko: "该路径当前不存在，提交时会先请求创建确认。",
                en: "This path does not exist yet. Creation confirmation will be requested.",
                ja: "このパスはまだ存在しません。作成確認後に続行されます。",
                zh: "该路径当前不存在，提交时会先请求创建确认。",
              })}
            </p>
          )}
          <p className="text-xs text-slate-500">
            {t({
              ko: "说明内容会保存为新项目的核心目标。",
              en: "Description will be saved as the new project core goal.",
              ja: "説明欄の内容が新規プロジェクトのコア目標として保存されます。",
              zh: "说明内容会保存为新项目的核心目标。",
            })}
          </p>
        </div>
      )}

      {!projectsLoading && projects.length === 0 && (
        <p className="mt-1 text-xs text-slate-500">
          {t({
            ko: "暂无已注册项目。请先在项目管理中创建。",
            en: "No registered project. Create one first in Project Manager.",
            ja: "登録済みプロジェクトがありません。先にプロジェクト管理で作成してください。",
            zh: "暂无已注册项目。请先在项目管理中创建。",
          })}
        </p>
      )}
    </div>
  );
}

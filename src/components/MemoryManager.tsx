import { useEffect, useState, useCallback } from "react";
import {
  listMemorySecretaries,
  getAgentMemory,
  saveAgentMemory,
  appendAgentMemory,
  type MemorySecretary,
  type MemoryLog,
} from "../api/memories";

export default function MemoryManager() {
  const [secretaries, setSecretaries] = useState<MemorySecretary[]>([]);
  const [selected, setSelected] = useState<MemorySecretary | null>(null);
  const [content, setContent] = useState("");
  const [logs, setLogs] = useState<MemoryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [appendInput, setAppendInput] = useState("");
  const [appendSection, setAppendSection] = useState("## 对话摘要");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    listMemorySecretaries().then(setSecretaries).catch(() => {});
  }, []);

  const loadMemory = useCallback(async (agent: MemorySecretary) => {
    setSelected(agent);
    setLoading(true);
    try {
      const { content: c, logs: l } = await getAgentMemory(agent.id);
      setContent(c);
      setLogs(l);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await saveAgentMemory(selected.id, content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      const { logs: l } = await getAgentMemory(selected.id);
      setLogs(l);
    } finally {
      setSaving(false);
    }
  };

  const handleAppend = async () => {
    if (!selected || !appendInput.trim()) return;
    setSaving(true);
    try {
      const { content: updated } = await appendAgentMemory(selected.id, appendInput.trim(), appendSection);
      setContent(updated);
      setAppendInput("");
      const { logs: l } = await getAgentMemory(selected.id);
      setLogs(l);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors";
  const inputStyle = { background: "var(--th-input-bg)", borderColor: "var(--th-input-border)", color: "var(--th-text-primary)" };

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* 左侧秘书列表 */}
      <div
        className="w-56 shrink-0 rounded-xl p-3 flex flex-col gap-1 overflow-y-auto"
        style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
      >
        <div className="text-[10px] uppercase font-semibold tracking-widest mb-2" style={{ color: "var(--th-text-muted)" }}>
          秘书列表
        </div>
        {secretaries.length === 0 && (
          <div className="text-xs" style={{ color: "var(--th-text-muted)" }}>暂无秘书</div>
        )}
        {secretaries.map((s) => (
          <button
            key={s.id}
            onClick={() => loadMemory(s)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors ${
              selected?.id === s.id ? "bg-blue-600/20 text-blue-400" : "hover:bg-[var(--th-bg-surface-hover)]"
            }`}
            style={{ color: selected?.id === s.id ? undefined : "var(--th-text-secondary)" }}
          >
            <span className="text-base shrink-0">{s.avatar_emoji || "📋"}</span>
            <span className="flex-1 truncate">{s.name}</span>
            {s.has_memory && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400">有</span>
            )}
          </button>
        ))}
      </div>

      {/* 右侧记忆编辑区 */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {!selected ? (
          <div
            className="flex-1 rounded-xl flex items-center justify-center"
            style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)", color: "var(--th-text-muted)" }}
          >
            <span className="text-sm">← 选择一个秘书查看记忆</span>
          </div>
        ) : (
          <>
            {/* 头部 */}
            <div
              className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{selected.avatar_emoji || "📋"}</span>
                <div>
                  <div className="font-semibold text-sm" style={{ color: "var(--th-text-heading)" }}>{selected.name}</div>
                  <div className="text-[10px]" style={{ color: "var(--th-text-muted)" }}>记忆文件 · memories/{selected.id}.md</div>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors"
              >
                {saved ? "已保存 ✓" : saving ? "保存中..." : "保存修改"}
              </button>
            </div>

            {/* 记忆文件编辑器 */}
            <div
              className="flex-1 rounded-xl p-4 flex flex-col gap-2 min-h-0"
              style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
            >
              <div className="text-[10px] uppercase font-semibold tracking-widest" style={{ color: "var(--th-text-muted)" }}>
                记忆内容（Markdown）
              </div>
              {loading ? (
                <div className="flex-1 flex items-center justify-center" style={{ color: "var(--th-text-muted)" }}>
                  <span className="text-sm">加载中...</span>
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="flex-1 min-h-[200px] px-3 py-2 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-none"
                  style={inputStyle}
                />
              )}
            </div>

            {/* 新增记忆 */}
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
            >
              <div className="text-[10px] uppercase font-semibold tracking-widest" style={{ color: "var(--th-text-muted)" }}>
                新增记忆条目
              </div>
              <div className="flex gap-2">
                <select
                  value={appendSection}
                  onChange={(e) => setAppendSection(e.target.value)}
                  className="px-2 py-1.5 border rounded-lg text-xs cursor-pointer focus:outline-none"
                  style={{ ...inputStyle, width: "140px" }}
                >
                  <option value="## 用户信息">用户信息</option>
                  <option value="## 对话摘要">对话摘要</option>
                  <option value="## 关键偏好">关键偏好</option>
                </select>
                <input
                  type="text"
                  value={appendInput}
                  onChange={(e) => setAppendInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAppend()}
                  placeholder="输入记忆内容，回车或点击添加..."
                  className={`${inputCls} flex-1`}
                  style={inputStyle}
                />
                <button
                  onClick={handleAppend}
                  disabled={saving || !appendInput.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-colors shrink-0"
                >
                  添加
                </button>
              </div>
            </div>

            {/* 操作日志 */}
            {logs.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
              >
                <div className="text-[10px] uppercase font-semibold tracking-widest mb-2" style={{ color: "var(--th-text-muted)" }}>
                  最近操作记录
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {logs.slice(0, 10).map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-xs">
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          log.type === "purge"
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-blue-500/15 text-blue-400"
                        }`}
                      >
                        {log.type === "purge" ? "提纯" : "新增"}
                      </span>
                      <span className="flex-1 truncate" style={{ color: "var(--th-text-secondary)" }}>{log.content}</span>
                      <span className="shrink-0 text-[10px]" style={{ color: "var(--th-text-muted)" }}>
                        {new Date(log.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  appendAgentMemory,
  getAgentMemory,
  listMemorySecretaries,
  purifyAgentMemory,
  saveAgentMemory,
  type MemoryLog,
  type MemorySecretary,
} from "../api/memories";

function formatMemoryTime(timestamp: number | null): string {
  if (!timestamp) return "尚未生成";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export default function MemoryManager() {
  const [secretaries, setSecretaries] = useState<MemorySecretary[]>([]);
  const [selected, setSelected] = useState<MemorySecretary | null>(null);
  const [content, setContent] = useState("");
  const [logs, setLogs] = useState<MemoryLog[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purifying, setPurifying] = useState(false);
  const [appendInput, setAppendInput] = useState("");
  const [appendSection, setAppendSection] = useState("## 对话摘要");
  const [saved, setSaved] = useState(false);
  const [compareBefore, setCompareBefore] = useState("");
  const [compareAfter, setCompareAfter] = useState("");
  const [compareMethod, setCompareMethod] = useState<"llm" | "local" | null>(null);

  const inputCls =
    "w-full rounded-xl border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30";
  const inputStyle = {
    background: "var(--th-input-bg)",
    borderColor: "var(--th-input-border)",
    color: "var(--th-text-primary)",
  };

  const refreshSecretaries = useCallback(async () => {
    const items = await listMemorySecretaries();
    setSecretaries(items);
  }, []);

  useEffect(() => {
    refreshSecretaries().catch(() => {});
  }, [refreshSecretaries]);

  const loadMemory = useCallback(async (agent: MemorySecretary) => {
    setSelected(agent);
    setLoading(true);
    setCompareBefore("");
    setCompareAfter("");
    setCompareMethod(null);
    try {
      const payload = await getAgentMemory(agent.id);
      setContent(payload.content);
      setLogs(payload.logs);
      setUpdatedAt(payload.updated_at);
    } finally {
      setLoading(false);
    }
  }, []);

  const compareDelta = useMemo(() => {
    if (!compareBefore || !compareAfter) return null;
    return compareAfter.length - compareBefore.length;
  }, [compareAfter, compareBefore]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await saveAgentMemory(selected.id, content);
      setUpdatedAt(result.updated_at ?? null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      const payload = await getAgentMemory(selected.id);
      setLogs(payload.logs);
      setUpdatedAt(payload.updated_at);
      await refreshSecretaries();
    } finally {
      setSaving(false);
    }
  };

  const handleAppend = async () => {
    if (!selected || !appendInput.trim()) return;
    setSaving(true);
    try {
      const result = await appendAgentMemory(selected.id, appendInput.trim(), appendSection);
      setContent(result.content);
      setUpdatedAt(result.updated_at ?? null);
      setAppendInput("");
      const payload = await getAgentMemory(selected.id);
      setLogs(payload.logs);
      setUpdatedAt(payload.updated_at);
      await refreshSecretaries();
    } finally {
      setSaving(false);
    }
  };

  const handlePurify = async () => {
    if (!selected) return;
    setPurifying(true);
    try {
      const result = await purifyAgentMemory(selected.id, content);
      setContent(result.content);
      setLogs(result.logs);
      setUpdatedAt(result.updated_at);
      setCompareBefore(result.before_content);
      setCompareAfter(result.content);
      setCompareMethod(result.method);
      await refreshSecretaries();
    } finally {
      setPurifying(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside
        className="min-h-0 overflow-y-auto rounded-[24px] p-3"
        style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
      >
        <div className="mb-3 px-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--th-text-muted)" }}>
            秘书记忆
          </div>
          <div className="mt-2 text-sm leading-6" style={{ color: "var(--th-text-secondary)" }}>
            选择秘书后，可以查看、编辑、追加和提纯长期记忆。
          </div>
        </div>

        <div className="space-y-2">
          {secretaries.length === 0 ? (
            <div className="rounded-2xl border px-3 py-4 text-sm" style={{ borderColor: "var(--th-card-border)", color: "var(--th-text-muted)" }}>
              暂无秘书
            </div>
          ) : (
            secretaries.map((secretary) => (
              <button
                key={secretary.id}
                onClick={() => loadMemory(secretary)}
                className="w-full rounded-2xl border px-3 py-3 text-left transition-all hover:-translate-y-[1px]"
                style={{
                  background: selected?.id === secretary.id ? "var(--th-bg-surface)" : "var(--th-card-bg)",
                  borderColor: selected?.id === secretary.id ? "rgba(59,130,246,0.45)" : "var(--th-card-border)",
                  boxShadow: selected?.id === secretary.id ? "0 12px 30px -24px rgba(59,130,246,0.6)" : "none",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold" style={{ color: "var(--th-text-heading)" }}>
                      {secretary.name}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: "var(--th-text-muted)" }}>
                      {secretary.has_memory ? "已建立记忆文件" : "尚未生成记忆文件"}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-1 text-[10px] font-medium"
                    style={{
                      background: secretary.has_memory ? "rgba(16,185,129,0.16)" : "var(--th-bg-surface)",
                      color: secretary.has_memory ? "#34d399" : "var(--th-text-muted)",
                    }}
                  >
                    {secretary.has_memory ? "可用" : "空白"}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="min-h-0">
        {!selected ? (
          <div
            className="flex h-full min-h-[320px] items-center justify-center rounded-[28px]"
            style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)", color: "var(--th-text-muted)" }}
          >
            <span className="text-sm">选择一个秘书后开始管理记忆</span>
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <div
              className="rounded-[28px] p-5"
              style={{
                background:
                  "radial-gradient(circle at top left, rgba(59,130,246,0.14), transparent 46%), linear-gradient(135deg, rgba(255,255,255,0.08), rgba(15,23,42,0.02)), var(--th-card-bg)",
                border: "1px solid var(--th-card-border)",
              }}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--th-text-muted)" }}>
                    Memory Workspace
                  </div>
                  <div className="mt-3 text-2xl font-semibold" style={{ color: "var(--th-text-heading)" }}>
                    {selected.name}
                  </div>
                  <div className="mt-2 text-sm" style={{ color: "var(--th-text-secondary)" }}>
                    记忆文件路径：`memories/{selected.id}.md`
                  </div>
                  <div className="mt-2 text-sm" style={{ color: "var(--th-text-secondary)" }}>
                    最后更新时间：{formatMemoryTime(updatedAt)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handlePurify}
                    disabled={purifying || saving || loading}
                    className="rounded-xl px-3 py-2 text-sm font-medium transition-all disabled:opacity-50"
                    style={{
                      background: "rgba(16,185,129,0.14)",
                      border: "1px solid rgba(16,185,129,0.28)",
                      color: "#34d399",
                    }}
                  >
                    {purifying ? "提纯中..." : "手动提纯"}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || purifying || loading}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-50"
                  >
                    {saved ? "已保存" : saving ? "保存中..." : "保存修改"}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid min-h-0 grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.35fr)_380px]">
              <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-4">
                <div
                  className="min-h-0 rounded-[28px] p-4"
                  style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--th-text-muted)" }}>
                        记忆内容
                      </div>
                      <div className="mt-1 text-sm" style={{ color: "var(--th-text-secondary)" }}>
                        支持直接编辑 Markdown 内容，秘书启动任务时会自动注入这份记忆。
                      </div>
                    </div>
                    {compareMethod && (
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                        style={{
                          background: compareMethod === "llm" ? "rgba(59,130,246,0.14)" : "rgba(245,158,11,0.14)",
                          color: compareMethod === "llm" ? "#60a5fa" : "#fbbf24",
                        }}
                      >
                        {compareMethod === "llm" ? "LLM 提纯" : "规则提纯"}
                      </span>
                    )}
                  </div>

                  {loading ? (
                    <div className="flex h-[360px] items-center justify-center text-sm" style={{ color: "var(--th-text-muted)" }}>
                      加载中...
                    </div>
                  ) : (
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="h-[360px] w-full resize-none rounded-[22px] border px-4 py-3 font-mono text-xs leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      style={inputStyle}
                    />
                  )}
                </div>

                <div
                  className="rounded-[28px] p-4"
                  style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
                >
                  <div className="mb-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--th-text-muted)" }}>
                      新增记忆条目
                    </div>
                    <div className="mt-1 text-sm" style={{ color: "var(--th-text-secondary)" }}>
                      快速将一条信息追加到指定记忆分区。
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_auto]">
                    <select
                      value={appendSection}
                      onChange={(e) => setAppendSection(e.target.value)}
                      className={inputCls}
                      style={inputStyle}
                    >
                      <option value="## 用户信息">用户信息</option>
                      <option value="## 重要决策记录">重要决策记录</option>
                      <option value="## 对话摘要">对话摘要</option>
                      <option value="## 关键偏好">关键偏好</option>
                    </select>
                    <input
                      type="text"
                      value={appendInput}
                      onChange={(e) => setAppendInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleAppend();
                      }}
                      placeholder="输入要追加的记忆内容"
                      className={inputCls}
                      style={inputStyle}
                    />
                    <button
                      onClick={handleAppend}
                      disabled={saving || purifying || !appendInput.trim()}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                    >
                      添加条目
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
                {(compareBefore || compareAfter) && (
                  <div
                    className="rounded-[28px] p-4"
                    style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--th-text-muted)" }}>
                          提纯结果对比
                        </div>
                        <div className="mt-1 text-sm" style={{ color: "var(--th-text-secondary)" }}>
                          对比最近一次提纯前后的变化。
                        </div>
                      </div>
                      {compareDelta !== null && (
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                          style={{
                            background: compareDelta <= 0 ? "rgba(16,185,129,0.14)" : "rgba(59,130,246,0.14)",
                            color: compareDelta <= 0 ? "#34d399" : "#60a5fa",
                          }}
                        >
                          {compareDelta >= 0 ? `+${compareDelta}` : compareDelta} 字符
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div>
                        <div className="mb-2 text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
                          提纯前
                        </div>
                        <textarea
                          readOnly
                          value={compareBefore}
                          className="h-40 w-full resize-none rounded-[20px] border px-3 py-2 font-mono text-[11px] leading-6"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-medium" style={{ color: "var(--th-text-secondary)" }}>
                          提纯后
                        </div>
                        <textarea
                          readOnly
                          value={compareAfter}
                          className="h-40 w-full resize-none rounded-[20px] border px-3 py-2 font-mono text-[11px] leading-6"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className="rounded-[28px] p-4"
                  style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--th-text-muted)" }}>
                    记忆提示
                  </div>
                  <div className="mt-3 space-y-2 text-sm" style={{ color: "var(--th-text-secondary)" }}>
                    <div>任务完成后，tier=1 秘书会自动写入任务摘要与关键线索。</div>
                    <div>秘书再次启动任务时，系统会自动把这份记忆注入到 prompt 前缀。</div>
                    <div>手动提纯优先调用 LLM，失败时会回退到本地规则提纯。</div>
                  </div>
                </div>

                <div
                  className="min-h-0 rounded-[28px] p-4"
                  style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--th-text-muted)" }}>
                      最近操作记录
                    </div>
                    <div className="text-xs" style={{ color: "var(--th-text-muted)" }}>
                      共 {logs.length} 条
                    </div>
                  </div>

                  {logs.length === 0 ? (
                    <div className="rounded-2xl border px-3 py-4 text-sm" style={{ borderColor: "var(--th-card-border)", color: "var(--th-text-muted)" }}>
                      暂无操作记录
                    </div>
                  ) : (
                    <div className="space-y-2 overflow-y-auto pr-1">
                      {logs.slice(0, 20).map((log) => (
                        <div
                          key={log.id}
                          className="rounded-2xl border px-3 py-3"
                          style={{ borderColor: "var(--th-card-border)", background: "var(--th-bg-surface)" }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className="rounded-full px-2 py-1 text-[10px] font-medium"
                              style={{
                                background: log.type === "purge" ? "rgba(245,158,11,0.14)" : "rgba(59,130,246,0.14)",
                                color: log.type === "purge" ? "#fbbf24" : "#60a5fa",
                              }}
                            >
                              {log.type === "purge" ? "提纯" : "新增"}
                            </span>
                            <span className="text-[11px]" style={{ color: "var(--th-text-muted)" }}>
                              {formatMemoryTime(log.created_at)}
                            </span>
                          </div>
                          <div className="mt-2 text-sm leading-6" style={{ color: "var(--th-text-secondary)" }}>
                            {log.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

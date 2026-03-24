import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  type Connection,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { useI18n } from "../i18n";
import { updateWorkflow, type Workflow } from "../api/workflows";
import { getAgents } from "../api";

const NODE_TYPES = [
  { type: "start",     label: "开始",   color: "#22c55e", desc: "工作流入口" },
  { type: "end",       label: "结束",   color: "#ef4444", desc: "工作流出口" },
  { type: "agent",     label: "Agent", color: "#3b82f6", desc: "Agent 执行" },
  { type: "condition", label: "条件",   color: "#eab308", desc: "if/else 判断" },
  { type: "tool",      label: "工具",   color: "#a855f7", desc: "MCP/Skill" },
];

const NODE_COLOR: Record<string, string> = Object.fromEntries(NODE_TYPES.map((n) => [n.type, n.color]));

function makeNode(type: string, position: { x: number; y: number }): Node {
  const def = NODE_TYPES.find((n) => n.type === type)!;
  return {
    id: `${type}-${Date.now()}`,
    type: "default",
    position,
    data: { label: def.label, nodeType: type, description: "", agentId: "" },
    style: {
      background: NODE_COLOR[type] + "22",
      border: `2px solid ${NODE_COLOR[type]}`,
      borderRadius: 8,
      color: "#f1f5f9",
      minWidth: 100,
    },
  };
}

interface WorkflowEditorProps {
  workflow: Workflow | null;
  onBack: () => void;
  onSaved: (wf: Workflow) => void;
  usedAgentIds?: Set<string>;
}

export default function WorkflowEditor({ workflow, onBack, onSaved, usedAgentIds }: WorkflowEditorProps) {
  const { t } = useI18n();
  const initialNodes: Node[] = workflow?.nodes_json ? JSON.parse(workflow.nodes_json) : [];
  const initialEdges: Edge[] = workflow?.edges_json ? JSON.parse(workflow.edges_json) : [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [wfName, setWfName] = useState(workflow?.name ?? "");
  const [assignedAgentId, setAssignedAgentId] = useState(workflow?.assigned_agent_id ?? "");
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    getAgents().then((list) => setAgents(list.map((a) => ({ id: a.id, name: a.name })))).catch(() => {});
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow");
      if (!type) return;
      const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const position = { x: e.clientX - bounds.left - 50, y: e.clientY - bounds.top - 20 };
      setNodes((nds) => [...nds, makeNode(type, position)]);
    },
    [setNodes]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const updateSelectedNode = (key: string, value: string) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, [key]: value } }
          : n
      )
    );
    setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, [key]: value } } : prev);
  };

  const handleSave = async () => {
    if (!workflow) return;
    setSaving(true);
    try {
      const result = await updateWorkflow(workflow.id, {
        name: wfName.trim() || t({ ko: "이름 없음", en: "Untitled", ja: "無題", zh: "未命名工作流" }),
        nodes_json: JSON.stringify(nodes),
        edges_json: JSON.stringify(edges),
        assigned_agent_id: assignedAgentId || null,
      });
      onSaved(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";
  const inputSmCls = "w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)] bg-slate-900 text-white">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-800 border-b border-slate-700 shrink-0">
        <button
          onClick={onBack}
          className="border border-slate-700 text-slate-300 hover:bg-slate-700 rounded-lg px-4 py-2 text-sm transition-colors"
        >
          ← {t({ ko: "목록", en: "Back", ja: "一覧", zh: "返回" })}
        </button>
        <input
          type="text"
          value={wfName}
          onChange={(e) => setWfName(e.target.value)}
          placeholder={t({ ko: "워크플로우 이름", en: "Workflow name", ja: "ワークフロー名", zh: "工作流名称" })}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          style={{ minWidth: 200 }}
        />
        <span className="flex-1" />
        <label className="text-xs shrink-0 text-slate-400">
          {t({ ko: "담당자", en: "Assignee", ja: "担当者", zh: "负责人" })}
        </label>
        <select
          value={assignedAgentId}
          onChange={(e) => setAssignedAgentId(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-xs text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          style={{ minWidth: 120 }}
        >
          <option value="">{t({ ko: "미지정", en: "Unassigned", ja: "未設定", zh: "— 未指定 —" })}</option>
          {agents
            .filter((a) => !usedAgentIds?.has(a.id) || a.id === assignedAgentId)
            .map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
        </select>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors"
        >
          {saved
            ? t({ ko: "저장됨 ✓", en: "Saved ✓", ja: "保存済 ✓", zh: "已保存 ✓" })
            : saving
            ? t({ ko: "저장 중...", en: "Saving...", ja: "保存中...", zh: "保存中..." })
            : t({ ko: "저장", en: "Save", ja: "保存", zh: "保存" })}
        </button>
      </div>

      {/* 三栏布局 */}
      <div className="flex flex-1 min-h-0">
        {/* 左侧节点面板 */}
        <div className="w-[200px] shrink-0 p-3 flex flex-col gap-2 overflow-y-auto bg-slate-800 border-r border-slate-700">
          <div className="text-[10px] uppercase font-semibold tracking-widest mb-1 text-slate-500">
            {t({ ko: "노드 유형", en: "Node Types", ja: "ノードタイプ", zh: "节点类型" })}
          </div>
          {NODE_TYPES.map((nt) => (
            <div
              key={nt.type}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("application/reactflow", nt.type)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing select-none text-xs transition-opacity hover:opacity-80"
              style={{
                background: nt.color + "22",
                border: `1.5px solid ${nt.color}`,
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: nt.color }}
              />
              <div>
                <div className="font-medium text-white">{nt.label}</div>
                <div className="text-[10px] text-slate-400">{nt.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 中间画布 */}
        <div className="flex-1 min-w-0" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
          >
            <Controls />
            <MiniMap />
            <Background />
          </ReactFlow>
        </div>

        {/* 右侧属性面板 */}
        <div className="w-[220px] shrink-0 p-3 flex flex-col gap-3 overflow-y-auto bg-slate-800 border-l border-slate-700">
          <div className="text-[10px] uppercase font-semibold tracking-widest text-slate-500">
            {t({ ko: "속성", en: "Properties", ja: "プロパティ", zh: "节点属性" })}
          </div>
          {!selectedNode ? (
            <p className="text-[11px] text-slate-500">
              {t({ ko: "노드를 클릭해서 편집하세요", en: "Click a node to edit", ja: "ノードをクリックして編集", zh: "点击节点进行编辑" })}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[10px] mb-1 text-slate-400">
                  {t({ ko: "노드 유형", en: "Node Type", ja: "ノードタイプ", zh: "节点类型" })}
                </label>
                <div
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: NODE_COLOR[selectedNode.data.nodeType] + "22", color: NODE_COLOR[selectedNode.data.nodeType] }}
                >
                  {NODE_TYPES.find((n) => n.type === selectedNode.data.nodeType)?.label ?? selectedNode.data.nodeType}
                </div>
              </div>
              <div>
                <label className="block text-[10px] mb-1 text-slate-400">
                  {t({ ko: "라벨", en: "Label", ja: "ラベル", zh: "标签" })}
                </label>
                <input
                  type="text"
                  value={selectedNode.data.label ?? ""}
                  onChange={(e) => updateSelectedNode("label", e.target.value)}
                  className={inputSmCls}
                />
              </div>
              {selectedNode.data.nodeType === "agent" && (
                <div>
                  <label className="block text-[10px] mb-1 text-slate-400">
                    {t({ ko: "Agent 선택", en: "Select Agent", ja: "Agentを選択", zh: "选择 Agent" })}
                  </label>
                  <select
                    value={selectedNode.data.agentId ?? ""}
                    onChange={(e) => updateSelectedNode("agentId", e.target.value)}
                    className={`${inputSmCls} cursor-pointer`}
                  >
                    <option value="">{t({ ko: "미선택", en: "— None —", ja: "未選択", zh: "— 未选择 —" })}</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10px] mb-1 text-slate-400">
                  {t({ ko: "비고", en: "Notes", ja: "備考", zh: "备注" })}
                </label>
                <textarea
                  value={selectedNode.data.description ?? ""}
                  onChange={(e) => updateSelectedNode("description", e.target.value)}
                  rows={3}
                  className={`${inputSmCls} resize-none`}
                />
              </div>
              <button
                onClick={() => {
                  setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                  setSelectedNode(null);
                }}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-400/50 transition-colors"
              >
                {t({ ko: "노드 삭제", en: "Delete Node", ja: "ノード削除", zh: "删除节点" })}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

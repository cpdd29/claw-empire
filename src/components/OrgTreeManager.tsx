import { useState, useEffect, useCallback } from "react";
import { post, del, patch, request } from "../api/core";
import { useI18n } from "../i18n";
import type { Agent, Department, WorkflowPackKey } from "../types";
import { getAgents } from "../api/organization-projects";
import type { OrgNode, OrgNodeTree, CreateOrgNodeRequest, OrgNodeTier } from "../types/org-nodes";
import { buildOrgNodeTree, TIER_CONFIG } from "../types/org-nodes";

interface OrgTreeManagerProps {
  onBack: () => void;
  departments?: Department[];
  officePackOptions?: { key: WorkflowPackKey; label: string; summary: string; slug: string; accent: number }[];
  officePackKey?: WorkflowPackKey;
  onChangeOfficeWorkflowPack?: (key: WorkflowPackKey) => void;
}

interface ApiResponse {
  ok: boolean;
  nodes?: OrgNode[];
  node?: OrgNode;
  agents?: Agent[];
  error?: string;
}

interface DeleteResponse {
  ok: boolean;
  error?: string;
}

export default function OrgTreeManager({
  onBack,
  departments = [],
  officePackOptions = [],
  officePackKey = "development",
  onChangeOfficeWorkflowPack,
}: OrgTreeManagerProps) {
  const { t, locale } = useI18n();
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    name_ko: "",
    tier: 1 as OrgNodeTier,
    parent_id: "",
    agent_id: "",
  });

  // Edit modal state
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingNode, setEditingNode] = useState<OrgNode | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    name_ko: "",
    tier: 1 as OrgNodeTier,
    agent_id: "",
    leader_agent_id: "",
  });
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [nodeAgents, setNodeAgents] = useState<Agent[]>([]);
  const [saving, setSaving] = useState(false);

  // 设置秘书弹框
  const [secretaryModalDeptId, setSecretaryModalDeptId] = useState<string | null>(null);
  const [secretarySaving, setSecretarySaving] = useState(false);

  const tier1Nodes = nodes.filter((n) => n.tier === 1);

  const getSecretaryForDept = (deptId: string): OrgNode | undefined =>
    nodes.find((n) => n.tier === 1 && n.department_id === deptId);

  const handleSetSecretary = async (nodeId: string, deptId: string) => {
    setSecretarySaving(true);
    try {
      // 先清除该节点原有 department_id（如果有其他节点绑定了该部门）
      const prev = nodes.find((n) => n.tier === 1 && n.department_id === deptId && n.id !== nodeId);
      if (prev) {
        await patch(`/api/org-nodes/${prev.id}`, { department_id: null });
      }
      await patch(`/api/org-nodes/${nodeId}`, { department_id: deptId });
      setSecretaryModalDeptId(null);
      fetchNodes();
    } catch (err) {
      console.error("Set secretary failed:", err);
    } finally {
      setSecretarySaving(false);
    }
  };

  // Fetch all agents
  useEffect(() => {
    getAgents().then(setAllAgents).catch(console.error);
  }, []);

  // Open edit modal
  const openEditModal = async (node: OrgNode) => {
    setEditingNode(node);
    setEditForm({
      name: node.name,
      name_ko: node.name_ko || "",
      tier: node.tier,
      agent_id: "",
      leader_agent_id: "",
    });
    // Parse existing metadata
    if (node.metadata_json) {
      try {
        const meta = JSON.parse(node.metadata_json);
        if (meta.agent_id) setEditForm((prev) => ({ ...prev, agent_id: meta.agent_id }));
        if (meta.leader_agent_id) setEditForm((prev) => ({ ...prev, leader_agent_id: meta.leader_agent_id }));
      } catch {}
    }
    // Fetch node's agents
    try {
      const res = await request<ApiResponse>(`/api/org-nodes/${node.id}/agents`);
      if (res.ok && res.agents) {
        setNodeAgents(res.agents);
      } else {
        setNodeAgents([]);
      }
    } catch {
      setNodeAgents([]);
    }
    setShowEditForm(true);
  };

  // Handle edit save
  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode || !editForm.name.trim()) return;

    setSaving(true);
    try {
      const metadata: Record<string, string> = {};
      if (editForm.agent_id) metadata.agent_id = editForm.agent_id;
      if (editForm.leader_agent_id) metadata.leader_agent_id = editForm.leader_agent_id;

      const body = {
        name: editForm.name,
        name_ko: editForm.name_ko,
        tier: editForm.tier,
        metadata_json: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      };

      const res = await patch<ApiResponse>(`/api/org-nodes/${editingNode.id}`, body);
      if (res.ok) {
        setShowEditForm(false);
        setEditingNode(null);
        fetchNodes();
      } else {
        setError(res.error || "Failed to update node");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update node");
    } finally {
      setSaving(false);
    }
  };

  const fetchNodes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await request<ApiResponse>("/api/org-nodes");
      if (res.ok && res.nodes) {
        setNodes(res.nodes);
      } else {
        setError(res.error || "Failed to fetch nodes");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;

    // Validation: tier > 0 requires agent_id
    if (createForm.tier > 0 && !createForm.agent_id) {
      setError(t({ ko: "请选择担当人", en: "Please select an agent", ja: "エージェントを選択してください", zh: "请选择担当人" }));
      return;
    }

    try {
      const body = {
        name: createForm.name,
        name_ko: createForm.name_ko,
        tier: createForm.tier,
        parent_id: createForm.parent_id || null,
        agent_id: createForm.tier > 0 ? createForm.agent_id : null,
      };

      const res = await post<ApiResponse>("/api/org-nodes", body);
      if (res.ok) {
        setShowCreateForm(false);
        setCreateForm({ name: "", name_ko: "", tier: 1, parent_id: "", agent_id: "" });
        fetchNodes();
      } else {
        setError(res.error || "Failed to create node");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create node");
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!confirm("Are you sure you want to delete this node?")) return;

    try {
      const res = await del<DeleteResponse>(`/api/org-nodes/${nodeId}`);
      if (res.ok) {
        fetchNodes();
        if (selectedNode?.id === nodeId) {
          setSelectedNode(null);
        }
      } else {
        setError(res.error || "Failed to delete node");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete node");
    }
  };

  const toggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedIds(newExpanded);
  };

  const getTierLabel = (tier: OrgNodeTier) => {
    const labels: Record<OrgNodeTier, string> = {
      0: t({ ko: "超级CEO", en: "SuperCEO", ja: "最高CEO", zh: "超级CEO" }),
      1: t({ ko: "秘书", en: "Secretary", ja: "秘书", zh: "秘书" }),
      2: t({ ko: "组长", en: "Leader", ja: "リーダー", zh: "组长" }),
      3: t({ ko: "员工", en: "Agent", ja: "エージェント", zh: "员工" }),
    };
    return labels[tier] || `Tier ${tier}`;
  };

  const getTierColor = (tier: OrgNodeTier) => {
    const config = TIER_CONFIG[tier];
    return config.color.light;
  };

  // Get agent info from node - check both agent_id field and metadata_json.agent_id
  const getNodeAgent = (node: OrgNode): Agent | undefined => {
    // Check direct agent_id field first
    if (node.agent_id) {
      return allAgents.find((a) => a.id === node.agent_id);
    }
    // Fallback to metadata_json.agent_id
    if (node.metadata_json) {
      try {
        const meta = JSON.parse(node.metadata_json);
        if (meta.agent_id) {
          return allAgents.find((a) => a.id === meta.agent_id);
        }
      } catch {}
    }
    return undefined;
  };

  const [activeTab, setActiveTab] = useState<"roles" | "departments">("roles");

  const tree = buildOrgNodeTree(nodes);

  const renderNode = (node: OrgNodeTree, level = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedNode?.id === node.id;
    const tierColor = getTierColor(node.tier);

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-3 rounded-lg border border-slate-700 p-3 cursor-pointer transition-all ${
            isSelected
              ? "border-blue-500/50 bg-blue-500/10"
              : "bg-slate-800/50 hover:bg-slate-800"
          }`}
          style={{ marginLeft: level > 0 ? `${level * 24}px` : 0 }}
          onClick={() => setSelectedNode(node)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="w-6 h-6 flex items-center justify-center text-xs rounded-md bg-slate-700/50 hover:bg-slate-700 transition-colors"
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          ) : (
            <span className="w-6" />
          )}

          <span
            className="w-9 h-9 flex items-center justify-center rounded-lg text-base font-bold"
            style={{ backgroundColor: tierColor + "20", color: tierColor }}
          >
            {TIER_CONFIG[node.tier].icon}
          </span>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-100 truncate">
              {locale === "ko" && node.name_ko ? node.name_ko : node.name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{getTierLabel(node.tier)}</p>
          </div>

          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium border"
            style={{
              backgroundColor: tierColor + "15",
              color: tierColor,
              borderColor: tierColor + "40",
            }}
          >
            {TIER_CONFIG[node.tier].icon} {TIER_CONFIG[node.tier].label.zh}
          </span>

          {/* Show agent badge if assigned */}
          {(() => {
            const agent = getNodeAgent(node);
            if (agent) {
              return (
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                  {agent.avatar_emoji || "🤖"} {agent.name}
                </span>
              );
            }
            return null;
          })()}

          {/* Edit button - only for tier > 0 */}
          {node.tier > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(node);
              }}
              className="opacity-0 group-hover:opacity-100 px-2.5 py-1 text-xs rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
            >
              ✏️
            </button>
          )}

          {node.id !== "super-ceo-root" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteNode(node.id);
              }}
              className="opacity-0 group-hover:opacity-100 px-2.5 py-1 text-xs rounded-md bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
            >
              🗑️
            </button>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-2 mt-2">
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const getTierSelectLabel = (tier: OrgNodeTier) => {
    return `${TIER_CONFIG[tier].icon} ${TIER_CONFIG[tier].label.zh}`;
  };

  return (
    <div className="space-y-4">
      {/* Header Card - 文档库风格 */}
      <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🏢</span>
              {t({ ko: "组织架构", en: "Organization Tree", ja: "組織構成", zh: "组织架构" })}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {t({
                ko: "无限层级嵌套",
                en: "Infinite nested CEO structure",
                ja: "無限階層構造",
                zh: "无限层级嵌套",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchNodes}
              className="px-3 py-2 text-xs bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              🔄
            </button>
            {activeTab === "roles" && (
            <button
              onClick={() => {
                setCreateForm({
                  name: "",
                  name_ko: "",
                  tier: selectedNode ? Math.min(selectedNode.tier + 1, 3) as OrgNodeTier : 1,
                  parent_id: selectedNode?.id || "",
                  agent_id: "",
                });
                setShowCreateForm(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-violet-600/20 text-violet-300 border border-violet-500/30 rounded-lg hover:bg-violet-600/30 transition-all"
            >
              <span className="text-base">+</span>
              {t({ ko: "添加节点", en: "Add Node", ja: "ノード追加", zh: "添加节点" })}
            </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{t({ ko: "图例:", en: "Legend:", ja: "凡例:", zh: "图例:" })}</span>
          {([0, 1, 2, 3] as OrgNodeTier[]).map((tier) => (
            <span
              key={tier}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{
                backgroundColor: TIER_CONFIG[tier].color.light + "15",
                color: TIER_CONFIG[tier].color.light,
                borderColor: TIER_CONFIG[tier].color.light + "30",
              }}
            >
              {TIER_CONFIG[tier].icon}
              <span>{TIER_CONFIG[tier].label.zh}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tab switcher */}
      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{ background: "var(--th-card-bg, #1e293b)", border: "1px solid var(--th-card-border, #334155)" }}
      >
        {([
          { key: "roles" as const, label: t({ ko: "角色管理", en: "Roles", ja: "役割管理", zh: "角色管理" }), icon: "🏛️" },
          { key: "departments" as const, label: t({ ko: "部门管理", en: "Departments", ja: "部署管理", zh: "部门管理" }), icon: "🏢" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? "bg-blue-600 text-white shadow-sm" : "hover:bg-white/5"
            }`}
            style={activeTab !== tab.key ? { color: "var(--th-text-muted, #94a3b8)" } : undefined}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab1: 角色管理 */}
      {activeTab === "roles" && (
        <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <p className="text-4xl mb-3">🗂️</p>
              <p className="text-lg font-medium">{t({ ko: "暂无组织节点", en: "No org nodes yet", ja: "ノードなし", zh: "暂无组织节点" })}</p>
              <p className="text-sm mt-1">{t({ ko: "点击添加节点开始", en: "Click Add Node to start", ja: "追加して開始", zh: "点击添加节点开始" })}</p>
            </div>
          ) : (
            <div className="space-y-2">{tree.map((node) => renderNode(node))}</div>
          )}
        </div>
      )}

      {/* Tab2: 部门管理 */}
      {activeTab === "departments" && (
        <div className="space-y-4">
          {/* 工作室设置 */}
          {officePackOptions.length > 0 && (
            <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-400 mb-2">
                {t({ ko: "工作室", en: "Workspace", ja: "ワークスペース", zh: "工作室" })}
              </p>
              <select
                value={officePackKey}
                onChange={(e) => onChangeOfficeWorkflowPack?.(e.target.value as WorkflowPackKey)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {officePackOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.slug} · {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 部门列表 */}
          <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 min-h-[300px]">
          {departments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <p className="text-4xl mb-3">🏢</p>
              <p className="text-lg font-medium">{t({ ko: "暂无部门", en: "No departments", ja: "部署なし", zh: "暂无部门" })}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {departments.map((dept) => {
                const secretary = getSecretaryForDept(dept.id);
                return (
                  <div
                    key={dept.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
                  >
                    <span className="text-2xl">{dept.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-100 truncate">
                        {locale === "ko" && dept.name_ko ? dept.name_ko : dept.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{dept.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {secretary ? (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {TIER_CONFIG[1].icon} {secretary.name}
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-500 border border-slate-600">
                          {t({ ko: "秘书未设置", en: "No secretary", ja: "秘书未設定", zh: "未设置秘书" })}
                        </span>
                      )}
                      <button
                        onClick={() => setSecretaryModalDeptId(dept.id)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/30 transition-all"
                      >
                        {t({ ko: "设置秘书", en: "Set Secretary", ja: "秘书設定", zh: "设置秘书" })}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
      )}

      {/* 设置秘书弹框 */}
      {secretaryModalDeptId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSecretaryModalDeptId(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-100">
                {t({ ko: "设置秘书", en: "Set Secretary", ja: "秘书設定", zh: "设置秘书" })}
              </h3>
              <button
                onClick={() => setSecretaryModalDeptId(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              {t({ ko: "从 tier=1 节点中选择", en: "Select a tier=1 node", ja: "tier=1ノードを選択", zh: "从 tier=1 节点中选择" })}
            </p>
            {tier1Nodes.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                {t({ ko: "暂无 tier=1 节点", en: "No tier=1 nodes available", ja: "tier=1ノードなし", zh: "暂无 tier=1 节点" })}
              </p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {tier1Nodes.map((node) => (
                  <button
                    key={node.id}
                    disabled={secretarySaving}
                    onClick={() => handleSetSecretary(node.id, secretaryModalDeptId)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    <span>{TIER_CONFIG[1].icon}</span>
                    <span className="flex-1">{node.name}</span>
                    {node.department_id === secretaryModalDeptId && (
                      <span className="text-xs text-emerald-400">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <form
            onSubmit={handleCreateNode}
            className="w-full max-w-md mx-4 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6"
          >
            <h3 className="text-lg font-bold mb-5 text-slate-100">
              {t({ ko: "新增节点", en: "Add New Node", ja: "新規ノード追加", zh: "新增节点" })}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-300">
                  {t({ ko: "名称 (EN)", en: "Name (EN)", ja: "名前 (EN)", zh: "名称 (EN)" })}
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-300">
                  {t({ ko: "本地名称", en: "Local Name", ja: "ローカル名", zh: "本地名称" })}
                </label>
                <input
                  type="text"
                  value={createForm.name_ko}
                  onChange={(e) => setCreateForm({ ...createForm, name_ko: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                  placeholder={t({
                    ko: "本地名称",
                    en: "Korean/Japanese/Chinese",
                    ja: "韓国語/日本語/中国語",
                    zh: "韩语/日语/中文",
                  })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-300">
                  {t({ ko: "角色 (Tier)", en: "Role (Tier)", ja: "役職", zh: "角色 (Tier)" })}
                </label>
                <select
                  value={createForm.tier}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, tier: parseInt(e.target.value) as OrgNodeTier })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                >
                  <option value={0}>{getTierSelectLabel(0)}</option>
                  <option value={1}>{getTierSelectLabel(1)}</option>
                  <option value={2}>{getTierSelectLabel(2)}</option>
                  <option value={3}>{getTierSelectLabel(3)}</option>
                </select>
                <p className="text-xs text-slate-500 mt-1.5">
                  {t({
                    ko: "超级CEO=根节点 | 秘书=部门管理 | 组长=团队领导 | 员工=执行者",
                    en: "SuperCEO=Root | Secretary=Dept Mgmt | Leader=Team Lead | Agent=Executor",
                    ja: "最高CEO=ルート | 秘书=部門管理 | リーダー=チーム領導 | エージェント=実行者",
                    zh: "超级CEO=根节点 | 秘书=部门管理 | 组长=团队领导 | 员工=执行者",
                  })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-300">
                  {t({ ko: "上级节点", en: "Parent Node", ja: "親ノード", zh: "上级节点" })}
                </label>
                <select
                  value={createForm.parent_id}
                  onChange={(e) => setCreateForm({ ...createForm, parent_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">
                    --{" "}
                    {t({ ko: "无 (根节点)", en: "None (Root)", ja: "なし (ルート)", zh: "无 (根节点)" })} --
                  </option>
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {TIER_CONFIG[node.tier].icon} {node.name} ({TIER_CONFIG[node.tier].label.zh})
                    </option>
                  ))}
                </select>
              </div>

              {/* Agent selector - required for tier > 0, hidden for tier 0 (SuperCEO) */}
              {createForm.tier > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-300">
                    {t({ ko: "担当人", en: "Agent", ja: "担当者", zh: "担当人" })} <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={createForm.agent_id}
                    onChange={(e) => setCreateForm({ ...createForm, agent_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                    required
                  >
                    <option value="">
                      -- {t({ ko: "请选择", en: "Select", ja: "選択してください", zh: "请选择" })} --
                    </option>
                    {allAgents
                      .filter((agent) => {
                        // Filter out agents already assigned to other nodes
                        // Check both org_nodes.agent_id field AND metadata_json.agent_id
                        return !nodes.some((n) => {
                          // Check direct agent_id field
                          if (n.agent_id === agent.id) return true;
                          // Check metadata_json.agent_id
                          if (n.metadata_json) {
                            try {
                              const meta = JSON.parse(n.metadata_json);
                              if (meta.agent_id === agent.id) return true;
                            } catch {}
                          }
                          return false;
                        });
                      })
                      .map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.avatar_emoji || "🤖"} {agent.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-amber-400 mt-1">
                    {t({
                      ko: "⚠️ 一人只能绑定一个节点",
                      en: "⚠️ One agent can only be assigned to one node",
                      ja: "⚠️ 一人のエージェントは一つのノードにのみ割り当て可能",
                      zh: "⚠️ 一人只能绑定一个节点",
                    })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
              >
                {t({ ko: "取消", en: "Cancel", ja: "キャンセル", zh: "取消" })}
              </button>
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium">
                {t({ ko: "添加", en: "Add", ja: "追加", zh: "添加" })}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Form Modal */}
      {showEditForm && editingNode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <form
            onSubmit={handleEditSave}
            className="w-full max-w-md mx-4 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6"
          >
            <h3 className="text-lg font-bold mb-5 text-slate-100 flex items-center gap-2">
              <span>✏️</span>
              {t({ ko: "编辑节点", en: "Edit Node", ja: "ノード編集", zh: "编辑节点" })}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-300">
                  {t({ ko: "名称 (EN)", en: "Name (EN)", ja: "名前 (EN)", zh: "名称 (EN)" })} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-300">
                  {t({ ko: "本地名称", en: "Local Name", ja: "ローカル名", zh: "本地名称" })}
                </label>
                <input
                  type="text"
                  value={editForm.name_ko}
                  onChange={(e) => setEditForm({ ...editForm, name_ko: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                  placeholder={t({ ko: "本地名称", en: "Korean/Japanese/Chinese", ja: "韓国語/日本語/中国語", zh: "韩语/日语/中文" })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-300">
                  {t({ ko: "角色 (Tier)", en: "Role (Tier)", ja: "役職", zh: "角色 (Tier)" })}
                </label>
                <select
                  value={editForm.tier}
                  onChange={(e) => setEditForm({ ...editForm, tier: parseInt(e.target.value) as OrgNodeTier })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                >
                  {/* Cannot change to SuperCEO (tier 0) in edit mode */}
                  <option value={1}>{getTierSelectLabel(1)}</option>
                  <option value={2}>{getTierSelectLabel(2)}</option>
                  <option value={3}>{getTierSelectLabel(3)}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-300">
                  {t({ ko: "负责人", en: "Person in Charge", ja: "責任者", zh: "负责人" })}
                </label>
                <select
                  value={editForm.agent_id}
                  onChange={(e) => setEditForm({ ...editForm, agent_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">-- {t({ ko: "无", en: "None", ja: "なし", zh: "无" })} --</option>
                  {allAgents
                    .filter((agent) => {
                      // Filter out agents already assigned to other nodes
                      const isAssigned = nodes.some((n) => {
                        if (n.id === editingNode.id) return false;
                        if (n.metadata_json) {
                          try {
                            const meta = JSON.parse(n.metadata_json);
                            if (meta.agent_id === agent.id) return true;
                          } catch {}
                        }
                        return false;
                      });
                      return !isAssigned;
                    })
                    .map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.avatar_emoji || "🤖"} {agent.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Only for tier 2 (Leader) */}
              {editForm.tier === 2 && (
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-300">
                    {t({ ko: "设置组长", en: "Set Leader", ja: "リーダー設定", zh: "设置组长" })}
                  </label>
                  <select
                    value={editForm.leader_agent_id}
                    onChange={(e) => setEditForm({ ...editForm, leader_agent_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="">-- {t({ ko: "无", en: "None", ja: "なし", zh: "无" })} --</option>
                    {nodeAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.avatar_emoji || "🤖"} {agent.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {t({ ko: "从属于此节点的员工中选择", en: "Select from agents assigned to this node", ja: "このノードに属するエージェントから選択", zh: "从属于此节点的员工中选择" })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowEditForm(false);
                  setEditingNode(null);
                }}
                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
              >
                {t({ ko: "取消", en: "Cancel", ja: "キャンセル", zh: "取消" })}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
              >
                {saving ? t({ ko: "保存中...", en: "Saving...", ja: "保存中...", zh: "保存中..." }) : t({ ko: "保存", en: "Save", ja: "保存", zh: "保存" })}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { post, del, request } from "../api/core";
import { useI18n } from "../i18n";
import type { OrgNode, OrgNodeTree, CreateOrgNodeRequest, OrgNodeTier } from "../types/org-nodes";
import { buildOrgNodeTree, TIER_CONFIG } from "../types/org-nodes";

interface OrgTreeManagerProps {
  onClose?: () => void;
}

interface ApiResponse {
  ok: boolean;
  nodes?: OrgNode[];
  node?: OrgNode;
  error?: string;
}

interface DeleteResponse {
  ok: boolean;
  error?: string;
}

export default function OrgTreeManager({ onClose }: OrgTreeManagerProps) {
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
  });

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

    try {
      const body: CreateOrgNodeRequest = {
        name: createForm.name,
        name_ko: createForm.name_ko,
        tier: createForm.tier,
        parent_id: createForm.parent_id || null,
      };

      const res = await post<ApiResponse>("/api/org-nodes", body);
      if (res.ok) {
        setShowCreateForm(false);
        setCreateForm({ name: "", name_ko: "", tier: 1, parent_id: "" });
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
    const config = TIER_CONFIG[tier];
    const labels: Record<OrgNodeTier, string> = {
      0: "👑 " + t({ ko: "超级CEO", en: "SuperCEO", ja: "最高CEO", zh: "超级CEO" }),
      1: "📋 " + t({ ko: "秘书", en: "Secretary", ja: " секретар", zh: "秘书" }),
      2: "👥 " + t({ ko: "组长", en: "Leader", ja: "リーダー", zh: "组长" }),
      3: "⚡ " + t({ ko: "员工", en: "Agent", ja: "エージェント", zh: "员工" }),
    };
    return labels[tier] || `Tier ${tier}`;
  };

  const getTierColor = (tier: OrgNodeTier, isDark = false) => {
    const config = TIER_CONFIG[tier];
    return isDark ? config.color.dark : config.color.light;
  };

  const tree = buildOrgNodeTree(nodes);

  const renderNode = (node: OrgNodeTree, level = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedNode?.id === node.id;
    const tierColor = getTierColor(node.tier);

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
            isSelected ? "ring-2 ring-blue-500" : "hover:ring-1 hover:ring-gray-300"
          }`}
          style={{ 
            paddingLeft: `${level * 24 + 12}px`,
            borderLeft: `3px solid ${tierColor}`
          }}
          onClick={() => setSelectedNode(node)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="w-5 h-5 flex items-center justify-center text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          ) : (
            <span className="w-5" />
          )}

          <span 
            className="text-lg w-8 h-8 flex items-center justify-center rounded-full"
            style={{ backgroundColor: tierColor + "20" }}
          >
            {TIER_CONFIG[node.tier].icon}
          </span>
          <span className="flex-1 font-medium truncate">
            {locale === "ko" && node.name_ko ? node.name_ko : node.name}
          </span>
          <span 
            className="text-xs px-2 py-0.5 rounded font-medium"
            style={{ 
              backgroundColor: tierColor + "20",
              color: tierColor
            }}
          >
            {getTierLabel(node.tier)}
          </span>

          {node.id !== "super-ceo-root" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteNode(node.id);
              }}
              className="px-2 py-1 text-xs rounded bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
            >
              🗑️
            </button>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const getTierIcon = (tier: OrgNodeTier) => {
    return TIER_CONFIG[tier].icon;
  };

  const getTierSelectLabel = (tier: OrgNodeTier) => {
    return `${TIER_CONFIG[tier].icon} ${TIER_CONFIG[tier].label.zh}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold">{t({ ko: "조직架构", en: "Organization Tree", ja: "組織構成", zh: "组织架构" })}</h2>
            <p className="text-sm text-gray-500">
              {t({ ko: "无限层级嵌套 CEO 구조", en: "Infinite nested CEO structure", ja: "無限階層構造", zh: "无限层级嵌套" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCreateForm({
                  name: "",
                  name_ko: "",
                  tier: selectedNode ? Math.min(selectedNode.tier + 1, 3) as OrgNodeTier : 1,
                  parent_id: selectedNode?.id || "",
                });
                setShowCreateForm(true);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              + {t({ ko: "添加节点", en: "Add Node", ja: "ノード追加", zh: "添加节点" })}
            </button>
            <button
              onClick={fetchNodes}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              🔄
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 py-2 border-b border-gray-100 dark:border-gray-800 text-xs">
          <span className="text-gray-500">{t({ ko: "图例:", en: "Legend:", ja: "凡例:", zh: "图例:" })}</span>
          {([0, 1, 2, 3] as OrgNodeTier[]).map((tier) => (
            <span 
              key={tier} 
              className="flex items-center gap-1 px-2 py-1 rounded"
              style={{ backgroundColor: TIER_CONFIG[tier].color.light + "15" }}
            >
              {TIER_CONFIG[tier].icon}
              <span style={{ color: TIER_CONFIG[tier].color.light }}>
                {TIER_CONFIG[tier].label.zh}
              </span>
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="space-y-1">
              {tree.map((node) => renderNode(node))}
            </div>
          )}
        </div>

        {/* Create Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
            <form
              onSubmit={handleCreateNode}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 w-full max-w-md"
            >
              <h3 className="text-lg font-bold mb-4">
                {t({ ko: "새 노드 추가", en: "Add New Node", ja: "新規ノード追加", zh: "新增节点" })}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t({ ko: "名称 (EN)", en: "Name (EN)", ja: "名前 (EN)", zh: "名称 (EN)" })}
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t({ ko: "本地名称", en: "Local Name", ja: "ローカル名", zh: "本地名称" })}
                  </label>
                  <input
                    type="text"
                    value={createForm.name_ko}
                    onChange={(e) => setCreateForm({ ...createForm, name_ko: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                    placeholder={t({ ko: "韩语/日语/中文", en: "Korean/Japanese/Chinese", ja: "韓国語/日本語/中国語", zh: "韩语/日语/中文" })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t({ ko: "직급 (Tier)", en: "Role (Tier)", ja: "役職", zh: "角色 (Tier)" })}
                  </label>
                  <select
                    value={createForm.tier}
                    onChange={(e) => setCreateForm({ ...createForm, tier: parseInt(e.target.value) as OrgNodeTier })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  >
                    <option value={0}>{getTierSelectLabel(0)}</option>
                    <option value={1}>{getTierSelectLabel(1)}</option>
                    <option value={2}>{getTierSelectLabel(2)}</option>
                    <option value={3}>{getTierSelectLabel(3)}</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {t({ 
                      ko: "超级CEO=根节点 | 秘书=部门管理 | 组长=团队领导 | 员工=执行者", 
                      en: "SuperCEO=Root | Secretary=Dept Mgmt | Leader=Team Lead | Agent=Executor", 
                      ja: "最高CEO=ルート | 秘书=部門管理 | リーダー=チーム領導 | エージェント=実行者",
                      zh: "超级CEO=根节点 | 秘书=部门管理 | 组长=团队领导 | 员工=执行者"
                    })}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t({ ko: "상위 노드", en: "Parent Node", ja: "親ノード", zh: "上级节点" })}
                  </label>
                  <select
                    value={createForm.parent_id}
                    onChange={(e) => setCreateForm({ ...createForm, parent_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  >
                    <option value="">-- {t({ ko: "없음 (루트)", en: "None (Root)", ja: "なし (ルート)", zh: "无 (根节点)" })} --</option>
                    {nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {getTierIcon(node.tier)} {node.name} ({TIER_CONFIG[node.tier].label.zh})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {t({ ko: "취소", en: "Cancel", ja: "キャンセル", zh: "取消" })}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  {t({ ko: "추가", en: "Add", ja: "追加", zh: "添加" })}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

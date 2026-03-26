import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import type { Agent, Department, Office } from "../types";
import { localeName, useI18n } from "../i18n";
import * as api from "../api";
import { normalizeOfficeWorkflowPack } from "../app/office-workflow-pack";
import { buildSpriteMap } from "./AgentAvatar";
import AgentFormModal from "./agent-manager/AgentFormModal";
import AgentsTab from "./agent-manager/AgentsTab";
import { BLANK, ICON_SPRITE_POOL } from "./agent-manager/constants";
import DepartmentFormModal from "./agent-manager/DepartmentFormModal";
import DepartmentsTab from "./agent-manager/DepartmentsTab";
import type { AgentManagerProps, FormData } from "./agent-manager/types";
import { pickRandomSpritePair } from "./agent-manager/utils";
import type { OrgNode } from "../types/org-nodes";
import { TIER_CONFIG } from "../types/org-nodes";

function inferFormTier(agent: Agent): 0 | 1 | 2 | 3 {
  if (agent.role === "senior") return 1;
  if (agent.role === "team_leader") return agent.department_id ? 2 : 0;
  return 3;
}

// Identity Modal Component
function IdentityModal({
  agent,
  orgNodes,
  tr,
  onClose,
  onConfirm,
}: {
  agent: Agent;
  orgNodes: OrgNode[];
  tr: (ko: string, en: string) => string;
  onClose: () => void;
  onConfirm: (action: "unbind" | "bind", nodeId: string | null) => void;
}) {
  const overlayRef = useCallback((node: HTMLDivElement | null) => node, []);
  const [saving, setSaving] = useState(false);

  // Find current org node
  const currentOrgNode = orgNodes.find(
    (node) =>
      node.agent_id === agent.id ||
      (() => {
        try {
          const meta = JSON.parse(node.metadata_json || "{}");
          return meta.agent_id === agent.id;
        } catch {
          return false;
        }
      })(),
  );

  // Group available nodes by tier
  const availableNodes = orgNodes.filter((node) => {
    // Already bound to this agent
    if (node.agent_id === agent.id) return false;
    // Check metadata_json
    try {
      const meta = JSON.parse(node.metadata_json || "{}");
      if (meta.agent_id === agent.id) return false;
    } catch {
      // Ignore malformed metadata and keep the node available.
    }
    return true;
  });

  const nodesByTier = useMemo(() => {
    const grouped: Record<number, OrgNode[]> = {};
    for (const node of availableNodes) {
      if (!grouped[node.tier]) grouped[node.tier] = [];
      grouped[node.tier].push(node);
    }
    return grouped;
  }, [availableNodes]);

  const handleUnbind = async () => {
    if (!currentOrgNode) return;
    setSaving(true);
    try {
      await api.updateOrgNode(currentOrgNode.id, { agent_id: null });
      onConfirm("unbind", null);
    } catch (err) {
      console.error("Unbind failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleBind = async (nodeId: string) => {
    setSaving(true);
    try {
      // Unbind from current node first if exists
      if (currentOrgNode) {
        await api.updateOrgNode(currentOrgNode.id, { agent_id: null });
      }
      // Bind to new node
      await api.updateOrgNode(nodeId, { agent_id: agent.id });
      onConfirm("bind", nodeId);
    } catch (err) {
      console.error("Bind failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 shadow-2xl"
        style={{
          background: "var(--th-card-bg)",
          border: "1px solid var(--th-card-border)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: "var(--th-text-heading)" }}>
            {tr("身份修改", "Modify Identity")}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--th-bg-surface-hover)] transition-colors"
            style={{ color: "var(--th-text-muted)" }}
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <div className="text-sm mb-2" style={{ color: "var(--th-text-secondary)" }}>
            {tr("当前 Agent:", "Current Agent:")} <strong>{agent.name}</strong>
          </div>
          {currentOrgNode ? (
            <div
              className="p-3 rounded-lg border"
              style={{
                background: "var(--th-bg-surface)",
                borderColor: "var(--th-card-border)",
              }}
            >
              <div className="text-sm" style={{ color: "var(--th-text-primary)" }}>
                {TIER_CONFIG[currentOrgNode.tier].icon} {TIER_CONFIG[currentOrgNode.tier].label.zh}: {currentOrgNode.name}
              </div>
            </div>
          ) : (
            <div
              className="p-3 rounded-lg border text-sm"
              style={{
                background: "var(--th-bg-surface)",
                borderColor: "var(--th-card-border)",
                color: "var(--th-text-muted)",
              }}
            >
              {tr("未分配身份", "Unassigned")}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {currentOrgNode && (
            <button
              onClick={handleUnbind}
              disabled={saving}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors disabled:opacity-50"
            >
              {tr("解绑", "Unbind")}
            </button>
          )}

          {Object.keys(nodesByTier).length > 0 && (
            <div>
              <div className="text-xs mb-2" style={{ color: "var(--th-text-muted)" }}>
                {tr("重新绑定到节点:", "Re-bind to node:")}
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {[2, 1, 0]
                  .filter((tier) => nodesByTier[tier]?.length)
                  .map((tier) => (
                    <div key={tier}>
                      <div
                        className="text-xs font-medium mb-1"
                        style={{ color: TIER_CONFIG[tier].color }}
                      >
                        {TIER_CONFIG[tier].icon} {TIER_CONFIG[tier].label.zh}
                      </div>
                      <div className="space-y-1">
                        {nodesByTier[tier].map((node) => (
                          <button
                            key={node.id}
                            onClick={() => handleBind(node.id)}
                            disabled={saving}
                            className="w-full px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-blue-500/10"
                            style={{
                              background: "var(--th-bg-surface)",
                              color: "var(--th-text-primary)",
                            }}
                          >
                            📋 {node.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {Object.keys(nodesByTier).length === 0 && (
            <div className="text-center py-4 text-sm" style={{ color: "var(--th-text-muted)" }}>
              {tr("没有可用的空闲节点", "No available nodes")}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--th-bg-surface-hover)]"
            style={{ border: "1px solid var(--th-card-border)", color: "var(--th-text-secondary)" }}
          >
            {tr("取消", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgentManager({
  agents,
  departments,
  onAgentsChange,
  activeOfficeWorkflowPack,
  dbBackedOfficePack = false,
  onSaveOfficePackProfile,
}: AgentManagerProps) {
  const { t, locale } = useI18n();
  const isKo = locale.startsWith("ko");
  const tr = useCallback((zh: string, en: string) => t({ ko: zh, en, ja: en, zh }), [t]);
  const officePackKey = normalizeOfficeWorkflowPack(activeOfficeWorkflowPack);
  const isIsolatedPack = officePackKey !== "development";
  const useDbBackedPack = isIsolatedPack && dbBackedOfficePack;

  const subTab: "agents" | "departments" = "agents";
  const [search, setSearch] = useState("");
  const [departmentAssignmentFilter, setDepartmentAssignmentFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [modalAgent, setModalAgent] = useState<Agent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);

  // Org nodes for identity management
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [identityModalAgent, setIdentityModalAgent] = useState<Agent | null>(null);

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deptOrder, setDeptOrder] = useState<Department[]>([]);
  const [deptOrderDirty, setDeptOrderDirty] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [draggingDeptId, setDraggingDeptId] = useState<string | null>(null);
  const [dragOverDeptId, setDragOverDeptId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | null>(null);

  // Load org nodes
  useEffect(() => {
    api.listOrgNodes().then(setOrgNodes).catch(console.error);
  }, []);

  useEffect(() => {
    api.getOffices().then(setOffices).catch(console.error);
  }, []);

  const parseNodeMetadata = useCallback((node: OrgNode | null | undefined) => {
    if (!node?.metadata_json) return {} as Record<string, unknown>;
    try {
      return JSON.parse(node.metadata_json) as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  }, []);

  const getNodeOfficeId = useCallback(
    (node: OrgNode | null | undefined) => {
      const metadata = parseNodeMetadata(node);
      return typeof metadata.office_id === "string" ? metadata.office_id : null;
    },
    [parseNodeMetadata],
  );

  const getAgentBoundOrgNodes = useCallback(
    (agentId: string) =>
      orgNodes.filter((node) => {
        if (node.agent_id === agentId) return true;
        const metadata = parseNodeMetadata(node);
        return typeof metadata.agent_id === "string" && metadata.agent_id === agentId;
      }),
    [orgNodes, parseNodeMetadata],
  );

  const getSecretaryNodeForAgent = useCallback(
    (agentId: string) =>
      orgNodes.find((node) => {
        if (node.tier !== 1) return false;
        if (node.agent_id === agentId) return true;
        const metadata = parseNodeMetadata(node);
        return typeof metadata.agent_id === "string" && metadata.agent_id === agentId;
      }) ?? null,
    [orgNodes, parseNodeMetadata],
  );

  const clearOfficeBindingFromSecretary = useCallback(
    async (node: OrgNode | null, agentId?: string) => {
      if (!node) return;
      const metadata = parseNodeMetadata(node);
      const nextMetadata = { ...metadata };
      let changed = false;
      if ("office_id" in nextMetadata) {
        delete nextMetadata.office_id;
        changed = true;
      }
      if (agentId && nextMetadata.agent_id === agentId) {
        delete nextMetadata.agent_id;
        changed = true;
      }
      if (!changed && node.agent_id !== agentId) return;
      await api.updateOrgNode(node.id, {
        ...(node.agent_id === agentId ? { agent_id: null } : {}),
        metadata_json: Object.keys(nextMetadata).length > 0 ? JSON.stringify(nextMetadata) : null,
      });
    },
    [parseNodeMetadata],
  );

  const syncSecretaryOfficeBinding = useCallback(
    async (
      targetAgent: Pick<Agent, "id" | "name" | "name_ko" | "name_ja" | "name_zh" | "department_id" | "role">,
      officeId: string | null,
    ) => {
      const boundNodes = getAgentBoundOrgNodes(targetAgent.id);
      const existingNode =
        boundNodes.find((node) => getNodeOfficeId(node) === officeId) ??
        boundNodes.find((node) => node.tier === 1) ??
        boundNodes[0] ??
        null;

      if (targetAgent.role !== "senior" || !officeId) {
        await Promise.all(boundNodes.map((node) => clearOfficeBindingFromSecretary(node)));
        return;
      }

      const previouslyBoundNodes = orgNodes.filter(
        (node) => node.tier === 1 && getNodeOfficeId(node) === officeId && node.id !== existingNode?.id,
      );
      for (const node of previouslyBoundNodes) {
        await clearOfficeBindingFromSecretary(node);
      }

      let secretaryNode = existingNode;
      if (!secretaryNode) {
        secretaryNode = await api.createOrgNode({
          name: targetAgent.name,
          name_ko: targetAgent.name_ko || targetAgent.name,
          name_ja: targetAgent.name_ja || targetAgent.name,
          name_zh: targetAgent.name_zh || targetAgent.name,
          tier: 1,
          parent_id: "super-ceo-root",
          department_id: targetAgent.department_id ?? null,
          agent_id: targetAgent.id,
          metadata_json: null,
        });
      }

      const metadata = parseNodeMetadata(secretaryNode);
      const nextMetadata = { ...metadata, office_id: officeId };
      await api.updateOrgNode(secretaryNode.id, {
        name: targetAgent.name,
        name_ko: targetAgent.name_ko || targetAgent.name,
        name_ja: targetAgent.name_ja || targetAgent.name,
        name_zh: targetAgent.name_zh || targetAgent.name,
        tier: 1,
        parent_id: "super-ceo-root",
        department_id: null,
        agent_id: targetAgent.id,
        metadata_json: JSON.stringify(nextMetadata),
      });

      const duplicateNodes = boundNodes.filter((node) => node.id !== secretaryNode?.id);
      for (const node of duplicateNodes) {
        await clearOfficeBindingFromSecretary(node, targetAgent.id);
      }
    },
    [clearOfficeBindingFromSecretary, getAgentBoundOrgNodes, getNodeOfficeId, orgNodes, parseNodeMetadata],
  );

  const persistIsolatedProfile = useCallback(
    async (nextDepartments: Department[], nextAgents: Agent[]) => {
      if (!isIsolatedPack) return;
      await onSaveOfficePackProfile(officePackKey, {
        departments: nextDepartments,
        agents: nextAgents,
        updated_at: Date.now(),
      });
    },
    [isIsolatedPack, officePackKey, onSaveOfficePackProfile],
  );

  useEffect(() => {
    setDeptOrder([...departments].sort((a, b) => a.sort_order - b.sort_order));
    setDeptOrderDirty(false);
    setDraggingDeptId(null);
    setDragOverDeptId(null);
    setDragOverPosition(null);
  }, [departments]);

  const spriteMap = buildSpriteMap(agents);
  const randomIconSprites = useMemo(
    () => ({
      total: pickRandomSpritePair(ICON_SPRITE_POOL),
    }),
    [],
  );
  const workingAgentCount = useMemo(
    () => agents.filter((agent) => agent.status === "working").length,
    [agents],
  );

  const filteredAgents = useMemo(
    () =>
      agents.filter((agent) => {
        if (departmentAssignmentFilter === "assigned" && !agent.department_id) return false;
        if (departmentAssignmentFilter === "unassigned" && agent.department_id) return false;
        if (!search) return true;
        const query = search.toLowerCase();
        return (
          agent.name.toLowerCase().includes(query) ||
          agent.name_ko.toLowerCase().includes(query) ||
          (agent.name_ja || "").toLowerCase().includes(query) ||
          (agent.name_zh || "").toLowerCase().includes(query)
        );
      }),
    [agents, departmentAssignmentFilter, search],
  );

  const officeSecretaryAgentIdByOffice = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of orgNodes) {
      if (node.tier !== 1) continue;
      const officeId = getNodeOfficeId(node);
      if (!officeId || map.has(officeId)) continue;
      const metadata = parseNodeMetadata(node);
      const agentId =
        node.agent_id || (typeof metadata.agent_id === "string" ? metadata.agent_id : null);
      if (!agentId) continue;
      map.set(officeId, agentId);
    }
    return map;
  }, [getNodeOfficeId, orgNodes, parseNodeMetadata]);

  const sortedAgents = useMemo(() => {
    const roleOrder: Record<string, number> = { team_leader: 0, senior: 1, junior: 2, intern: 3 };
    return [...filteredAgents].sort(
      (a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9) || a.name.localeCompare(b.name),
    );
  }, [filteredAgents]);

  const getAgentDeleteBindingSummary = useCallback(
    (agent: Agent) => {
      const department = departments.find((item) => item.id === agent.department_id) ?? null;
      const secretaryNode = agent.role === "senior" ? getSecretaryNodeForAgent(agent.id) : null;
      const officeId =
        agent.role === "senior"
          ? getNodeOfficeId(secretaryNode)
          : department?.office_id ?? null;
      const office = officeId ? offices.find((item) => item.id === officeId) ?? null : null;
      const bindings: string[] = [];

      if (office) {
        bindings.push(`办公室 ${localeName(locale, office)}`);
      }
      if (department) {
        bindings.push(`部门 ${localeName(locale, department)}`);
      }

      return bindings.join("、");
    },
    [departments, getNodeOfficeId, getSecretaryNodeForAgent, locale, offices],
  );

  const openCreate = useCallback(() => {
    setModalAgent(null);
    setForm({ ...BLANK });
    setShowModal(true);
  }, []);

  const openEdit = useCallback(
    (agent: Agent) => {
      setModalAgent(agent);
      const computed = agent.sprite_number ?? buildSpriteMap(agents).get(agent.id) ?? null;
      const department = departments.find((item) => item.id === agent.department_id) ?? null;
      const secretaryNode = agent.role === "senior" ? getSecretaryNodeForAgent(agent.id) : null;
      setForm({
        name: agent.name,
        name_ko: agent.name_ko,
        name_ja: agent.name_ja || "",
        name_zh: agent.name_zh || "",
        office_id: agent.role === "senior" ? getNodeOfficeId(secretaryNode) ?? "" : department?.office_id ?? "",
        department_id: agent.department_id || "",
        role: agent.role,
        tier: (agent as any).tier ?? inferFormTier(agent),
        cli_provider: agent.cli_provider,
        api_provider_id: (agent as any).api_provider_id || "",
        avatar_emoji: agent.avatar_emoji,
        sprite_number: computed,
        personality: agent.personality || "",
        agent_config: agent.agent_config || "",
        memory_config: agent.memory_config || "",
      });
      setShowModal(true);
    },
    [agents, departments, getNodeOfficeId, getSecretaryNodeForAgent],
  );

  const closeModal = useCallback(() => {
    setShowModal(false);
    setModalAgent(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const isSecretaryRole = form.role === "senior" || form.tier === 1;
      const departmentId = isSecretaryRole ? "" : form.department_id.trim();
      const officeId = isSecretaryRole ? form.office_id.trim() || null : null;
      const normalizedName = form.name.trim();
      const basePayload = {
        name: normalizedName,
        name_ko: form.name_ko.trim() || normalizedName,
        name_ja: form.name_ja.trim() || normalizedName,
        name_zh: form.name_zh.trim() || normalizedName,
        role: form.role,
        tier: form.tier,
        cli_provider: form.cli_provider,
        api_provider_id: form.api_provider_id || null,
        avatar_emoji: form.avatar_emoji || "🤖",
        sprite_number: form.sprite_number,
        personality: form.personality.trim() || null,
        agent_config: form.agent_config.trim() || null,
        memory_config: form.memory_config.trim() || null,
      };
      if (isIsolatedPack) {
        if (useDbBackedPack) {
          if (modalAgent) {
            await api.updateAgent(modalAgent.id, {
              ...basePayload,
              department_id: departmentId || null,
              workflow_pack_key: officePackKey,
            });
            await syncSecretaryOfficeBinding(
              {
                id: modalAgent.id,
                name: basePayload.name,
                name_ko: basePayload.name_ko,
                name_ja: basePayload.name_ja,
                name_zh: basePayload.name_zh,
                department_id: departmentId || null,
                role: basePayload.role,
              },
              officeId,
            );
            const nextAgents = agents.map((agent) =>
              agent.id === modalAgent.id
                ? {
                    ...agent,
                    ...basePayload,
                    department_id: departmentId || null,
                  }
                : agent,
            );
            await persistIsolatedProfile(departments, nextAgents);
          } else {
            const createdAgent = await api.createAgent({
              ...basePayload,
              department_id: departmentId || null,
              workflow_pack_key: officePackKey,
            });
            await syncSecretaryOfficeBinding(
              {
                id: createdAgent.id,
                name: createdAgent.name,
                name_ko: createdAgent.name_ko,
                name_ja: createdAgent.name_ja ?? null,
                name_zh: createdAgent.name_zh ?? null,
                department_id: departmentId || null,
                role: createdAgent.role,
              },
              officeId,
            );
            await persistIsolatedProfile(departments, [...agents, createdAgent]);
          }
          onAgentsChange();
        } else {
          const nextAgents = modalAgent
            ? agents.map((agent) =>
                agent.id === modalAgent.id
                  ? {
                      ...agent,
                      ...basePayload,
                      department_id: departmentId || null,
                    }
                  : agent,
              )
            : [
                ...agents,
                {
                  id:
                    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                      ? crypto.randomUUID()
                      : `agent-${Date.now()}`,
                  ...basePayload,
                  department_id: departmentId || null,
                  status: "idle" as const,
                  current_task_id: null,
                  stats_tasks_done: 0,
                  stats_xp: 0,
                  created_at: Date.now(),
                },
              ];
          await persistIsolatedProfile(departments, nextAgents);
        }
      } else {
        if (modalAgent) {
          await api.updateAgent(modalAgent.id, {
            ...basePayload,
            department_id: departmentId || null,
          });
          await syncSecretaryOfficeBinding(
            {
              id: modalAgent.id,
              name: basePayload.name,
              name_ko: basePayload.name_ko,
              name_ja: basePayload.name_ja,
              name_zh: basePayload.name_zh,
              department_id: departmentId || null,
              role: basePayload.role,
            },
            officeId,
          );
        } else {
          const createdAgent = await api.createAgent({
            ...basePayload,
            department_id: departmentId || null,
          });
          await syncSecretaryOfficeBinding(
            {
              id: createdAgent.id,
              name: createdAgent.name,
              name_ko: createdAgent.name_ko,
              name_ja: createdAgent.name_ja ?? null,
              name_zh: createdAgent.name_zh ?? null,
              department_id: departmentId || null,
              role: createdAgent.role,
            },
            officeId,
          );
        }
        onAgentsChange();
      }
      api.listOrgNodes().then(setOrgNodes).catch(() => {});
      closeModal();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [
    agents,
    closeModal,
    departments,
    form,
    isIsolatedPack,
    modalAgent,
    onAgentsChange,
    persistIsolatedProfile,
    setOrgNodes,
    syncSecretaryOfficeBinding,
    useDbBackedPack,
  ]);

  // Duplicate agent
  const handleDuplicateAgent = useCallback(
    async (agent: Agent) => {
      setSaving(true);
      try {
        const newAgent = await api.createAgent({
          name: `${agent.name} (副本)`,
          name_ko: agent.name_ko ? `${agent.name_ko} (副本)` : "",
          name_ja: agent.name_ja || "",
          name_zh: agent.name_zh || "",
          role: agent.role,
          cli_provider: agent.cli_provider,
          avatar_emoji: agent.avatar_emoji,
          sprite_number: agent.sprite_number,
          personality: agent.personality,
          department_id: agent.department_id,
        });
        onAgentsChange();
      } catch (err) {
        console.error("Duplicate failed:", err);
      } finally {
        setSaving(false);
      }
    },
    [onAgentsChange],
  );

  // Identity modal handlers
  const handleIdentityClick = useCallback((agent: Agent) => {
    setIdentityModalAgent(agent);
  }, []);

  const handleIdentityConfirm = useCallback(() => {
    setIdentityModalAgent(null);
    // Refresh org nodes
    api.listOrgNodes().then(setOrgNodes).catch(console.error);
  }, []);

  const handleDelete = useCallback(
    async (agent: Agent) => {
      const bindingSummary = getAgentDeleteBindingSummary(agent);
      if (
        bindingSummary &&
        !window.confirm(`该人员绑定了相关部门或办公室：${bindingSummary}，是否删除？`)
      ) {
        setConfirmDeleteId(null);
        return;
      }

      const id = agent.id;
      setSaving(true);
      try {
        if (isIsolatedPack) {
          if (useDbBackedPack) {
            await api.deleteAgent(id);
            const nextAgents = agents.filter((agent) => agent.id !== id);
            await persistIsolatedProfile(departments, nextAgents);
            onAgentsChange();
          } else {
            const nextAgents = agents.filter((agent) => agent.id !== id);
            await persistIsolatedProfile(departments, nextAgents);
          }
        } else {
          await api.deleteAgent(id);
          onAgentsChange();
        }
        setConfirmDeleteId(null);
        if (modalAgent?.id === id) closeModal();
      } catch (err) {
        console.error("Delete failed:", err);
      } finally {
        setSaving(false);
      }
    },
    [
      agents,
      closeModal,
      departments,
      getAgentDeleteBindingSummary,
      isIsolatedPack,
      modalAgent,
      onAgentsChange,
      persistIsolatedProfile,
      useDbBackedPack,
    ],
  );

  const openCreateDept = useCallback(() => {
    setEditDept(null);
    setShowDeptModal(true);
  }, []);

  const openEditDept = useCallback((department: Department) => {
    setEditDept(department);
    setShowDeptModal(true);
  }, []);

  const closeDeptModal = useCallback(() => {
    setShowDeptModal(false);
    setEditDept(null);
  }, []);

  const moveDept = useCallback(
    (index: number, direction: -1 | 1) => {
      const nextOrder = [...deptOrder];
      const target = index + direction;
      if (target < 0 || target >= nextOrder.length) return;
      [nextOrder[index], nextOrder[target]] = [nextOrder[target], nextOrder[index]];
      setDeptOrder(nextOrder);
      setDeptOrderDirty(true);
    },
    [deptOrder],
  );

  const getDropPosition = useCallback((event: DragEvent<HTMLDivElement>): "before" | "after" => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  }, []);

  const clearDeptDragState = useCallback(() => {
    setDraggingDeptId(null);
    setDragOverDeptId(null);
    setDragOverPosition(null);
  }, []);

  const moveDeptByDrag = useCallback(
    (dragDeptId: string, targetDeptId: string, position: "before" | "after") => {
      if (dragDeptId === targetDeptId) return;
      const fromIndex = deptOrder.findIndex((department) => department.id === dragDeptId);
      const targetIndex = deptOrder.findIndex((department) => department.id === targetDeptId);
      if (fromIndex < 0 || targetIndex < 0) return;

      const nextOrder = [...deptOrder];
      const [dragged] = nextOrder.splice(fromIndex, 1);
      let insertIndex = targetIndex + (position === "after" ? 1 : 0);
      if (fromIndex < insertIndex) insertIndex -= 1;
      insertIndex = Math.max(0, Math.min(insertIndex, nextOrder.length));
      nextOrder.splice(insertIndex, 0, dragged);

      const changed = nextOrder.some((department, i) => department.id !== deptOrder[i]?.id);
      if (!changed) return;
      setDeptOrder(nextOrder);
      setDeptOrderDirty(true);
    },
    [deptOrder],
  );

  const saveDeptOrder = useCallback(async () => {
    setReorderSaving(true);
    try {
      const nextDepartments = deptOrder.map((department, index) => ({
        ...department,
        sort_order: index + 1,
      }));
      if (isIsolatedPack) {
        if (useDbBackedPack) {
          const orders = nextDepartments.map((department) => ({
            id: department.id,
            sort_order: department.sort_order,
          }));
          await api.reorderDepartments(orders, { workflowPackKey: officePackKey });
          await persistIsolatedProfile(nextDepartments, agents);
          onAgentsChange();
        } else {
          await persistIsolatedProfile(nextDepartments, agents);
        }
      } else {
        const orders = nextDepartments.map((department) => ({ id: department.id, sort_order: department.sort_order }));
        await api.reorderDepartments(orders);
        onAgentsChange();
      }
      setDeptOrderDirty(false);
    } catch (err) {
      console.error("Reorder failed:", err);
    } finally {
      setReorderSaving(false);
    }
  }, [agents, deptOrder, isIsolatedPack, onAgentsChange, persistIsolatedProfile, useDbBackedPack]);

  const resetDeptOrder = useCallback(() => {
    setDeptOrder([...departments].sort((a, b) => a.sort_order - b.sort_order));
    setDeptOrderDirty(false);
  }, [departments]);

  const handleDeptDragStart = useCallback((deptId: string, event: DragEvent<HTMLDivElement>) => {
    setDraggingDeptId(deptId);
    setDragOverDeptId(null);
    setDragOverPosition(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", deptId);
  }, []);

  const handleDeptDragOver = useCallback(
    (deptId: string, event: DragEvent<HTMLDivElement>) => {
      if (!draggingDeptId || draggingDeptId === deptId) return;
      event.preventDefault();
      const nextPosition = getDropPosition(event);
      if (dragOverDeptId !== deptId || dragOverPosition !== nextPosition) {
        setDragOverDeptId(deptId);
        setDragOverPosition(nextPosition);
      }
      event.dataTransfer.dropEffect = "move";
    },
    [dragOverDeptId, dragOverPosition, draggingDeptId, getDropPosition],
  );

  const handleDeptDrop = useCallback(
    (deptId: string, event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const droppedId = event.dataTransfer.getData("text/plain") || draggingDeptId;
      if (droppedId && droppedId !== deptId) {
        moveDeptByDrag(droppedId, deptId, getDropPosition(event));
      }
      clearDeptDragState();
    },
    [clearDeptDragState, draggingDeptId, getDropPosition, moveDeptByDrag],
  );

  const handleIsolatedDepartmentSave = useCallback(
    async (input: {
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
    }) => {
      if (!isIsolatedPack) return;
      const nextDepartments =
        input.mode === "create"
          ? [
              ...departments,
              {
                id: input.id,
                name: input.payload.name,
                name_ko: input.payload.name_ko,
                name_ja: input.payload.name_ja,
                name_zh: input.payload.name_zh,
                office_id: input.payload.office_id,
                icon: input.payload.icon,
                color: "#64748b",
                description: input.payload.description,
                prompt: input.payload.prompt,
                sort_order: input.payload.sort_order,
                created_at: Date.now(),
              },
            ]
          : departments.map((department) =>
              department.id === input.id
                ? {
                    ...department,
                    name: input.payload.name,
                    name_ko: input.payload.name_ko,
                    name_ja: input.payload.name_ja,
                    name_zh: input.payload.name_zh,
                    office_id: input.payload.office_id,
                    icon: input.payload.icon,
                    color: department.color,
                    description: input.payload.description,
                    prompt: input.payload.prompt,
                    sort_order: input.payload.sort_order,
                  }
                : department,
            );

      const nextAgents = agents.map((agent) => {
        if (agent.id === input.leaderAgentId) {
          return {
            ...agent,
            department_id: input.id,
            role: "team_leader" as const,
          };
        }
        if (agent.department_id === input.id && agent.role === "team_leader") {
          return {
            ...agent,
            role: "senior" as const,
          };
        }
        return agent;
      });

      await persistIsolatedProfile(nextDepartments, nextAgents);
    },
    [agents, departments, isIsolatedPack, persistIsolatedProfile],
  );

  const handleIsolatedDepartmentDelete = useCallback(
    async (departmentId: string) => {
      if (!isIsolatedPack) return;
      const filteredDepartments = departments
        .filter((department) => department.id !== departmentId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((department, index) => ({
          ...department,
          sort_order: index + 1,
        }));
      const nextAgents = agents.map((agent) =>
        agent.department_id === departmentId
          ? {
              ...agent,
              department_id: null,
            }
          : agent,
      );
      await persistIsolatedProfile(filteredDepartments, nextAgents);
    },
    [agents, departments, isIsolatedPack, persistIsolatedProfile],
  );

  const handleDeleteDept = useCallback(
    async (department: Department) => {
      if (!window.confirm(`确认删除部门“${department.name}”吗？`)) return;
      try {
        if (isIsolatedPack && !useDbBackedPack) {
          await handleIsolatedDepartmentDelete(department.id);
        } else {
          await api.deleteDepartment(department.id, isIsolatedPack ? { workflowPackKey: officePackKey } : undefined);
          onAgentsChange();
        }
      } catch (err) {
        console.error("Delete department failed:", err);
      }
    },
    [isIsolatedPack, useDbBackedPack, handleIsolatedDepartmentDelete, officePackKey, onAgentsChange],
  );

  return (
    <div className="taskboard-shell flex h-full flex-col gap-4 bg-slate-950 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-white">{tr("员工管理", "Employees")}</h1>
        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
          {tr("当前", "Current")} {agents.length} {tr("名员工", "employees")}
        </span>
        <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-400">
          {tr("工作中", "Working")} {workingAgentCount}
        </span>
        <div className="ml-auto flex items-center gap-2">
        {subTab === "departments" && (
          <button
            onClick={openCreateDept}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-slate-700 active:scale-95"
          >
            + {tr("新建部门", "Add Department")}
          </button>
        )}
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-blue-500 active:scale-95"
        >
          + {tr("新建员工", "Add Employee")}
        </button>
      </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="grid gap-3 px-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,0.8fr)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-xs font-medium text-slate-400 sm:w-24 sm:flex-none">
              {tr("员工搜索", "Employee Search")}
            </label>
            <input
              type="text"
              placeholder={tr("按姓名搜索员工", "Search employees by name")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-xs font-medium text-slate-400 sm:w-24 sm:flex-none">
              {tr("部门筛选", "Department Filter")}
            </label>
            <select
              value={departmentAssignmentFilter}
              onChange={(e) => setDepartmentAssignmentFilter(e.target.value as "all" | "assigned" | "unassigned")}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="all">{tr("全部部门", "All Departments")}</option>
              <option value="assigned">{tr("已分配部门", "Assigned Department")}</option>
              <option value="unassigned">{tr("未分配部门", "Unassigned Department")}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <AgentsTab
          tr={tr}
          locale={locale}
          agents={agents}
          offices={offices}
          departments={departments}
          orgNodes={orgNodes}
          sortedAgents={sortedAgents}
          spriteMap={spriteMap}
          confirmDeleteId={confirmDeleteId}
          setConfirmDeleteId={setConfirmDeleteId}
          onEditAgent={openEdit}
          onDeleteAgent={handleDelete}
          onDuplicateAgent={handleDuplicateAgent}
          onIdentityClick={handleIdentityClick}
          saving={saving}
          randomIconSprites={{ total: randomIconSprites.total }}
        />
      </div>

      {subTab === "departments" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <DepartmentsTab
            tr={tr}
            locale={locale}
            agents={agents}
            departments={departments}
            deptOrder={deptOrder}
            deptOrderDirty={deptOrderDirty}
            reorderSaving={reorderSaving}
            draggingDeptId={draggingDeptId}
            dragOverDeptId={dragOverDeptId}
            dragOverPosition={dragOverPosition}
            onSaveOrder={saveDeptOrder}
            onCancelOrder={resetDeptOrder}
            onMoveDept={moveDept}
            onEditDept={openEditDept}
            onDeleteDept={handleDeleteDept}
            onDragStart={handleDeptDragStart}
            onDragOver={handleDeptDragOver}
            onDrop={handleDeptDrop}
            onDragEnd={clearDeptDragState}
          />
        </div>
      )}

      {showModal && (
        <AgentFormModal
          isKo={isKo}
          locale={locale}
          tr={tr}
          form={form}
          setForm={setForm}
          offices={offices}
          departments={departments}
          currentAgentId={modalAgent?.id ?? null}
          officeSecretaryAgentIdByOffice={officeSecretaryAgentIdByOffice}
          isEdit={!!modalAgent}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {showDeptModal && (
        <DepartmentFormModal
          locale={locale}
          tr={tr}
          department={editDept}
          departments={departments}
          offices={offices}
          agents={agents}
          workflowPackKey={isIsolatedPack ? officePackKey : undefined}
          onSave={() => {
            if (!isIsolatedPack || useDbBackedPack) onAgentsChange();
          }}
          onSaveDepartment={isIsolatedPack && !useDbBackedPack ? handleIsolatedDepartmentSave : undefined}
          onDeleteDepartment={isIsolatedPack && !useDbBackedPack ? handleIsolatedDepartmentDelete : undefined}
          onClose={closeDeptModal}
        />
      )}

      {identityModalAgent && (
        <IdentityModal
          agent={identityModalAgent}
          orgNodes={orgNodes}
          tr={tr}
          onClose={() => setIdentityModalAgent(null)}
          onConfirm={handleIdentityConfirm}
        />
      )}
    </div>
  );
}

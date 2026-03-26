import { useState, useCallback, useEffect, useMemo } from "react";
import { useI18n, localeName } from "../i18n";
import * as api from "../api";
import type { Office, Department, Agent } from "../types";
import OfficesTab from "./agent-manager/OfficesTab";
import OfficeFormModal, { type OfficeSecretaryOption } from "./agent-manager/OfficeFormModal";
import DepartmentsTab from "./agent-manager/DepartmentsTab";
import DepartmentFormModal from "./agent-manager/DepartmentFormModal";
import RolesTab from "./agent-manager/RolesTab";
import type { OrgNode } from "../types/org-nodes";

type TabType = "offices" | "departments" | "roles";

export default function OrgPageView() {
  const { t, locale } = useI18n();
  const tr = useCallback((zh: string, en: string) => t({ ko: zh, en, ja: en, zh }), [t]);

  const [activeTab, setActiveTab] = useState<TabType>("offices");
  const [selectedSecretaryFilter, setSelectedSecretaryFilter] = useState("");
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState("");
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState("");
  
  // Office state
  const [offices, setOffices] = useState<Office[]>([]);
  const [showOfficeModal, setShowOfficeModal] = useState(false);
  const [editOffice, setEditOffice] = useState<Office | null>(null);

  // Department state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [editDepartment, setEditDepartment] = useState<Department | null>(null);

  // Agent state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);

  // DepartmentsTab 需要的状态
  const [deptOrder, setDeptOrder] = useState<Department[]>([]);
  const [draggingDeptId, setDraggingDeptId] = useState<string | null>(null);
  const [dragOverDeptId, setDragOverDeptId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | null>(null);

  // Load data
  const loadOffices = useCallback(() => {
    return api.getOffices().then(setOffices).catch(console.error);
  }, []);

  const loadDepartments = useCallback(() => {
    return api
      .getDepartments()
      .then((depts) => {
        setDepartments(depts);
        setDeptOrder(depts);
      })
      .catch(console.error);
  }, []);

  const loadAgents = useCallback(() => {
    return api.getAgents().then(setAgents).catch(console.error);
  }, []);

  const loadOrgNodes = useCallback(() => {
    return api.listOrgNodes().then(setOrgNodes).catch(console.error);
  }, []);

  useEffect(() => {
    loadOffices();
    loadDepartments();
    loadAgents();
    loadOrgNodes();
  }, [loadOffices, loadDepartments, loadAgents, loadOrgNodes]);

  const parseNodeMetadata = useCallback((node: OrgNode) => {
    if (!node.metadata_json) return {} as Record<string, unknown>;
    try {
      return JSON.parse(node.metadata_json) as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  }, []);

  const getNodeAgentId = useCallback(
    (node: OrgNode) => {
      const metadata = parseNodeMetadata(node);
      return node.agent_id || (typeof metadata.agent_id === "string" ? metadata.agent_id : null);
    },
    [parseNodeMetadata],
  );

  const getNodeOfficeId = useCallback(
    (node: OrgNode) => {
      const metadata = parseNodeMetadata(node);
      return typeof metadata.office_id === "string" ? metadata.office_id : null;
    },
    [parseNodeMetadata],
  );

  const getOfficeSecretaryNode = useCallback(
    (officeId: string) => orgNodes.find((node) => node.tier === 1 && getNodeOfficeId(node) === officeId) ?? null,
    [getNodeOfficeId, orgNodes],
  );

  const getSecretaryNodeForAgent = useCallback(
    (agentId: string) =>
      orgNodes.find((node) => node.tier === 1 && getNodeAgentId(node) === agentId) ?? null,
    [getNodeAgentId, orgNodes],
  );

  const officeSecretaryLabels = useMemo(() => {
    const entries = offices.map((office) => {
      const secretaryNode = getOfficeSecretaryNode(office.id);
      if (!secretaryNode) return [office.id, ""] as const;
      const agent = agents.find((item) => item.id === getNodeAgentId(secretaryNode));
      const agentName = agent ? localeName(locale, agent) : secretaryNode.name;
      return [office.id, `${agentName}`] as const;
    });
    return Object.fromEntries(entries) as Record<string, string>;
  }, [agents, getNodeAgentId, getOfficeSecretaryNode, locale, offices]);

  const officeSecretaryAgentIdByOffice = useMemo(() => {
    const entries = offices.map((office) => {
      const secretaryNode = getOfficeSecretaryNode(office.id);
      return [office.id, secretaryNode ? getNodeAgentId(secretaryNode) ?? "" : ""] as const;
    });
    return Object.fromEntries(entries) as Record<string, string>;
  }, [getNodeAgentId, getOfficeSecretaryNode, offices]);

  const secretaryFilterOptions = useMemo(
    () =>
      agents
        .filter((agent) => agent.role === "senior")
        .sort((a, b) => localeName(locale, a).localeCompare(localeName(locale, b), locale))
        .map((agent) => ({ value: agent.id, label: localeName(locale, agent) })),
    [agents, locale],
  );

  const officeFilterOptions = useMemo(
    () =>
      offices
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order || a.created_at - b.created_at)
        .map((office) => ({
          value: office.id,
          label: localeName(locale, office),
        })),
    [locale, offices],
  );

  const departmentFilterOptions = useMemo(
    () =>
      departments
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order || localeName(locale, a).localeCompare(localeName(locale, b), locale))
        .map((department) => ({
          value: department.id,
          label: localeName(locale, department),
        })),
    [departments, locale],
  );

  const filteredOffices = useMemo(
    () =>
      selectedSecretaryFilter
        ? offices.filter((office) => officeSecretaryAgentIdByOffice[office.id] === selectedSecretaryFilter)
        : offices,
    [offices, officeSecretaryAgentIdByOffice, selectedSecretaryFilter],
  );

  const filteredDepartments = useMemo(
    () =>
      selectedOfficeFilter
        ? departments.filter((department) => department.office_id === selectedOfficeFilter)
        : departments,
    [departments, selectedOfficeFilter],
  );

  const filteredDepartmentIds = useMemo(
    () => new Set(filteredDepartments.map((department) => department.id)),
    [filteredDepartments],
  );

  const filteredDeptOrder = useMemo(
    () => deptOrder.filter((department) => filteredDepartmentIds.has(department.id)),
    [deptOrder, filteredDepartmentIds],
  );

  const departmentSecretaryAgentIdByDepartment = useMemo(() => {
    const entries = departments.map((department) => {
      const secretaryAgentId = department.office_id ? officeSecretaryAgentIdByOffice[department.office_id] ?? "" : "";
      return [department.id, secretaryAgentId] as const;
    });
    return Object.fromEntries(entries) as Record<string, string>;
  }, [departments, officeSecretaryAgentIdByOffice]);

  const filteredRoleAgents = useMemo(() => {
    if (!selectedDepartmentFilter) return agents;
    const secretaryAgentId = departmentSecretaryAgentIdByDepartment[selectedDepartmentFilter];
    return agents.filter(
      (agent) => agent.department_id === selectedDepartmentFilter || (secretaryAgentId ? agent.id === secretaryAgentId : false),
    );
  }, [agents, departmentSecretaryAgentIdByDepartment, selectedDepartmentFilter]);

  useEffect(() => {
    if (selectedSecretaryFilter && !secretaryFilterOptions.some((option) => option.value === selectedSecretaryFilter)) {
      setSelectedSecretaryFilter("");
    }
  }, [secretaryFilterOptions, selectedSecretaryFilter]);

  useEffect(() => {
    if (selectedOfficeFilter && !officeFilterOptions.some((option) => option.value === selectedOfficeFilter)) {
      setSelectedOfficeFilter("");
    }
  }, [officeFilterOptions, selectedOfficeFilter]);

  useEffect(() => {
    if (selectedDepartmentFilter && !departmentFilterOptions.some((option) => option.value === selectedDepartmentFilter)) {
      setSelectedDepartmentFilter("");
    }
  }, [departmentFilterOptions, selectedDepartmentFilter]);

  const availableSecretaryOptions = useMemo<OfficeSecretaryOption[]>(() => {
    const currentOfficeId = editOffice?.id ?? null;
    const nodeOptions = orgNodes
      .filter((node) => {
        if (node.tier !== 1) return false;
        const agentId = getNodeAgentId(node);
        if (!agentId) return false;
        const boundOfficeId = getNodeOfficeId(node);
        return !boundOfficeId || boundOfficeId === currentOfficeId;
      })
      .map((node) => {
        const agentId = getNodeAgentId(node);
        const agent = agents.find((item) => item.id === agentId);
        const department = departments.find((item) => item.id === (agent?.department_id ?? node.department_id));
        const agentName = agent ? localeName(locale, agent) : node.name;
        return {
          value: `node:${node.id}`,
          label: department ? `${agentName} · ${localeName(locale, department)}` : agentName,
          helper: `${tr("秘书节点", "Secretary Node")}: ${node.name}`,
        };
      });

    const fallbackAgentOptions = agents
      .filter((agent) => {
        if (agent.role !== "senior") return false;
        const existingNode = getSecretaryNodeForAgent(agent.id);
        if (!existingNode) return true;
        const boundOfficeId = getNodeOfficeId(existingNode);
        return boundOfficeId === currentOfficeId;
      })
      .filter((agent) => !nodeOptions.some((option) => option.value === `node:${getSecretaryNodeForAgent(agent.id)?.id}`))
      .map((agent) => {
        const department = departments.find((item) => item.id === agent.department_id);
        const agentName = localeName(locale, agent);
        return {
          value: `agent:${agent.id}`,
          label: department ? `${agentName} · ${localeName(locale, department)}` : agentName,
          helper: tr("保存时会自动创建秘书节点并绑定办公室", "Secretary node will be created on save"),
        };
      });

    return [...nodeOptions, ...fallbackAgentOptions];
  }, [
    agents,
    departments,
    editOffice?.id,
    getNodeAgentId,
    getNodeOfficeId,
    getSecretaryNodeForAgent,
    locale,
    orgNodes,
    tr,
  ]);

  const clearOfficeBindingFromSecretary = useCallback(
    async (node: OrgNode) => {
      const metadata = parseNodeMetadata(node);
      if (!("office_id" in metadata)) return;
      const nextMetadata = { ...metadata };
      delete nextMetadata.office_id;
      await api.updateOrgNode(node.id, {
        metadata_json: Object.keys(nextMetadata).length > 0 ? JSON.stringify(nextMetadata) : null,
      });
    },
    [parseNodeMetadata],
  );

  const bindSecretaryToOffice = useCallback(
    async (officeId: string, secretaryNodeId: string | null) => {
      const previouslyBoundNodes = orgNodes.filter(
        (node) => node.tier === 1 && getNodeOfficeId(node) === officeId && `node:${node.id}` !== secretaryNodeId,
      );
      for (const node of previouslyBoundNodes) {
        await clearOfficeBindingFromSecretary(node);
      }

      if (!secretaryNodeId) return;

      const [selectionType, selectionId] = secretaryNodeId.split(":");
      let targetNode =
        selectionType === "node" ? orgNodes.find((node) => node.id === selectionId) ?? null : null;

      if (!targetNode && selectionType === "agent") {
        const selectedAgent = agents.find((agent) => agent.id === selectionId);
        if (!selectedAgent) return;

        const existingNode = getSecretaryNodeForAgent(selectedAgent.id);
        if (existingNode) {
          targetNode = existingNode;
        } else {
          targetNode = await api.createOrgNode({
            name: selectedAgent.name,
            name_ko: selectedAgent.name_ko || selectedAgent.name,
            name_ja: selectedAgent.name_ja || selectedAgent.name,
            name_zh: selectedAgent.name_zh || selectedAgent.name,
            tier: 1,
            parent_id: "super-ceo-root",
            department_id: selectedAgent.department_id ?? null,
            agent_id: selectedAgent.id,
            metadata_json: null,
          });
        }
      }

      if (!targetNode) return;

      const metadata = parseNodeMetadata(targetNode);
      const nextMetadata = { ...metadata, office_id: officeId };
      await api.updateOrgNode(targetNode.id, { metadata_json: JSON.stringify(nextMetadata) });
    },
    [agents, clearOfficeBindingFromSecretary, getNodeOfficeId, getSecretaryNodeForAgent, orgNodes, parseNodeMetadata],
  );

  const handleOfficeDelete = useCallback(
    async (office: Office) => {
      try {
        await api.deleteOffice(office.id);
        await Promise.all([loadOffices(), loadOrgNodes()]);
        window.alert(tr("删除成功，已解除关联秘书", "Delete succeeded and the secretary binding has been cleared."));
      } catch (err) {
        if (api.isApiRequestError(err) && err.code === "office_has_departments") {
          window.alert(tr("该办公室下还有部门，不可删除", "This office still has departments and cannot be deleted."));
        }
        throw err;
      }
    },
    [loadOffices, loadOrgNodes, tr],
  );

  const handleDepartmentDelete = useCallback(
    async (department: Department) => {
      try {
        await api.deleteDepartment(department.id);
        await Promise.all([loadDepartments(), loadAgents(), loadOrgNodes()]);
        window.alert(tr("删除成功，已解除关联部长", "Delete succeeded and the leader binding has been cleared."));
      } catch (err) {
        if (api.isApiRequestError(err) && err.code === "department_has_employees") {
          window.alert(tr("该部门下还有员工，不可删除", "This department still has employees and cannot be deleted."));
        }
        throw err;
      }
    },
    [loadAgents, loadDepartments, loadOrgNodes, tr],
  );

  const syncDepartmentLeader = useCallback(
    async (departmentId: string, leaderAgentId: string) => {
      const nextLeader = agents.find((agent) => agent.id === leaderAgentId);
      if (!nextLeader) {
        throw new Error(`leader agent not found: ${leaderAgentId}`);
      }

      const updates: Promise<unknown>[] = [];
      for (const agent of agents) {
        if (agent.department_id === departmentId && agent.id !== leaderAgentId && agent.role === "team_leader") {
          updates.push(api.updateAgent(agent.id, { role: "senior" }));
        }
      }

      const nextLeaderPayload: Partial<Pick<Agent, "department_id" | "role">> = {};
      if (nextLeader.department_id !== departmentId) {
        nextLeaderPayload.department_id = departmentId;
      }
      if (nextLeader.role !== "team_leader") {
        nextLeaderPayload.role = "team_leader";
      }
      if (Object.keys(nextLeaderPayload).length > 0) {
        updates.push(api.updateAgent(nextLeader.id, nextLeaderPayload));
      }

      await Promise.all(updates);
    },
    [agents],
  );

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "offices", label: tr("办公室管理", "Offices"), icon: "🏢" },
    { id: "departments", label: tr("部门管理", "Departments"), icon: "👥" },
    { id: "roles", label: tr("角色成员", "Roles"), icon: "🎭" },
  ];

  const currentCount =
    activeTab === "offices"
      ? filteredOffices.length
      : activeTab === "departments"
        ? filteredDepartments.length
        : filteredRoleAgents.length;
  const currentCountLabel =
    activeTab === "offices"
      ? tr("个办公室", "offices")
      : activeTab === "departments"
        ? tr("个部门", "departments")
        : tr("名成员", "members");
  const currentFilterLabel =
    activeTab === "offices"
      ? tr("秘书筛选", "Secretary Filter")
      : activeTab === "departments"
        ? tr("办公室筛选", "Office Filter")
        : tr("部门筛选", "Department Filter");
  const currentFilterHint =
    activeTab === "offices"
      ? tr("切换秘书后，仅展示绑定到该秘书的办公室。", "Show only offices bound to the selected secretary.")
      : activeTab === "departments"
        ? tr("切换办公室后，仅展示绑定到该办公室的部门。", "Show only departments bound to the selected office.")
        : tr("切换部门后，仅展示绑定到该部门的成员。", "Show only members bound to the selected department.");

  return (
    <div className="taskboard-shell flex h-full flex-col gap-4 bg-slate-950 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-white">{tr("组织架构", "Organization")}</h1>
        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
          {tr("当前", "Current")} {currentCount} {currentCountLabel}
        </span>
        <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-400">
          {tr("办公室", "Offices")} {offices.length} / {tr("部门", "Departments")} {departments.length} / {tr("成员", "Agents")}{" "}
          {agents.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {activeTab === "offices" && (
            <button
              onClick={() => {
                setEditOffice(null);
                setShowOfficeModal(true);
              }}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-blue-500 active:scale-95"
            >
              + {tr("新建办公室", "Add Office")}
            </button>
          )}
          {activeTab === "departments" && (
            <button
              onClick={() => {
                setEditDepartment(null);
                setShowDepartmentModal(true);
              }}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-blue-500 active:scale-95"
            >
              + {tr("新建部门", "Add Department")}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="flex gap-1 rounded-xl bg-slate-950/40 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2 px-1 sm:flex-row sm:items-start">
          <label className="pt-2 text-xs font-medium text-slate-400 sm:w-24 sm:flex-none">{currentFilterLabel}</label>
          <div className="flex-1">
            {activeTab === "offices" && (
              <select
                value={selectedSecretaryFilter}
                onChange={(event) => setSelectedSecretaryFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">{tr("全部秘书", "All secretaries")}</option>
                {secretaryFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            {activeTab === "departments" && (
              <select
                value={selectedOfficeFilter}
                onChange={(event) => setSelectedOfficeFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">{tr("全部办公室", "All offices")}</option>
                {officeFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            {activeTab === "roles" && (
              <select
                value={selectedDepartmentFilter}
                onChange={(event) => setSelectedDepartmentFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">{tr("全部部门", "All departments")}</option>
                {departmentFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-2 text-xs text-slate-500">{currentFilterHint}</p>
          </div>
        </div>
      </div>

      {activeTab === "offices" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <OfficesTab
            tr={tr}
            offices={filteredOffices}
            officeSecretaryLabels={officeSecretaryLabels}
            onEditOffice={(office) => {
              setEditOffice(office);
              setShowOfficeModal(true);
            }}
            onDeleteOffice={async (office) => {
              if (!window.confirm(`确认删除办公室“${office.name}”吗？`)) return;
              try {
                await handleOfficeDelete(office);
              } catch (err) {
                if (!api.isApiRequestError(err)) {
                  console.error("Delete office failed:", err);
                }
              }
            }}
          />
        </div>
      )}

      {activeTab === "departments" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <DepartmentsTab
            tr={tr}
            locale={locale}
            agents={agents}
            departments={filteredDepartments}
            deptOrder={filteredDeptOrder}
            deptOrderDirty={false}
            reorderSaving={false}
            draggingDeptId={draggingDeptId}
            dragOverDeptId={dragOverDeptId}
            dragOverPosition={dragOverPosition}
            onSaveOrder={() => {}}
            onCancelOrder={() => {}}
            onMoveDept={() => {}}
            onEditDept={(dept) => {
              setEditDepartment(dept);
              setShowDepartmentModal(true);
            }}
            onDeleteDept={(dept) => {
              if (!window.confirm(`确认删除部门“${localeName(locale, dept)}”吗？`)) return;
              handleDepartmentDelete(dept).catch((err) => {
                if (!api.isApiRequestError(err)) {
                  console.error("Delete department failed:", err);
                }
              });
            }}
            onDragStart={(deptId, e) => {
              setDraggingDeptId(deptId);
            }}
            onDragOver={(deptId, e) => {
              setDragOverDeptId(deptId);
              setDragOverPosition("after");
            }}
            onDrop={(deptId, e) => {
              setDraggingDeptId(null);
              setDragOverDeptId(null);
              setDragOverPosition(null);
            }}
            onDragEnd={() => {
              setDraggingDeptId(null);
              setDragOverDeptId(null);
              setDragOverPosition(null);
            }}
          />
        </div>
      )}

      {activeTab === "roles" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <RolesTab
            tr={tr}
            locale={locale}
            agents={filteredRoleAgents}
            offices={offices}
            departments={departments}
            officeSecretaryAgentIdByOffice={officeSecretaryAgentIdByOffice}
          />
        </div>
      )}

      {showOfficeModal && (
        <OfficeFormModal
          tr={tr}
          office={editOffice}
          secretaryOptions={availableSecretaryOptions}
          initialSecretaryNodeId={
            editOffice && getOfficeSecretaryNode(editOffice.id) ? `node:${getOfficeSecretaryNode(editOffice.id)!.id}` : null
          }
          onSave={async (savedOffice, secretaryNodeId) => {
            await bindSecretaryToOffice(savedOffice.id, secretaryNodeId);
            await Promise.all([loadOffices(), loadOrgNodes()]);
          }}
          onDelete={async (office) => {
            await handleOfficeDelete(office);
          }}
          onClose={() => {
            setShowOfficeModal(false);
            setEditOffice(null);
          }}
        />
      )}

      {showDepartmentModal && (
        <DepartmentFormModal
          locale={locale}
          tr={tr}
          department={editDepartment}
          departments={departments}
          offices={offices}
          agents={agents}
          scopedOfficeId={selectedOfficeFilter || null}
          onSave={async () => {
            await Promise.all([loadDepartments(), loadAgents()]);
          }}
          onClose={() => {
            setShowDepartmentModal(false);
            setEditDepartment(null);
          }}
          onSaveDepartment={async ({ mode, id, leaderAgentId, payload }) => {
            if (mode === "create") {
              await api.createDepartment({ id, ...payload });
            } else {
              await api.updateDepartment(id, payload);
            }
            await syncDepartmentLeader(id, leaderAgentId);
          }}
          onDeleteDepartment={async (departmentId) => {
            await api.deleteDepartment(departmentId);
            await Promise.all([loadDepartments(), loadAgents(), loadOrgNodes()]);
            window.alert(tr("删除成功，已解除关联部长", "Delete succeeded and the leader binding has been cleared."));
          }}
        />
      )}
    </div>
  );
}

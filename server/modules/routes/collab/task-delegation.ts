import { randomUUID } from "node:crypto";

import type { AgentRow } from "./direct-chat.ts";
import type { DelegationOptions } from "./project-resolution.ts";
import type { Lang } from "../../../types/lang.ts";
import type { L10n } from "./language-policy.ts";
import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { resolveWorkflowPackKeyForTask } from "../../workflow/packs/task-pack-resolver.ts";
import { isWorkflowPackKey } from "../../workflow/packs/definitions.ts";
import { resolveConstrainedAgentScopeForTask } from "../core/tasks/execution-run-auto-assign.ts";
import {
  buildDelegateMessage,
  buildLeaderAckMessage,
  buildManualFallbackNotice,
  buildSelfExecutionMessage,
  buildSubordinateAckMessage,
} from "./task-delegation-messages.ts";

interface TaskDelegationDeps {
  db: RuntimeContext["db"];
  nowMs: () => number;
  resolveLang: (text?: string, fallback?: Lang) => Lang;
  getDeptName: (deptId: string) => string;
  getRoleLabel: (role: string, lang: Lang) => string;
  detectTargetDepartments: (message: string) => string[];
  findBestSubordinate: (deptId: string, excludeId: string, candidateAgentIds?: string[] | null) => AgentRow | null;
  normalizeTextField: (value: unknown) => string | null;
  resolveProjectFromOptions: (options: DelegationOptions) => {
    id: string | null;
    name: string | null;
    projectPath: string | null;
    coreGoal: string | null;
  };
  buildRoundGoal: (projectCoreGoal: string | null, ceoMessage: string) => string;
  resolveDirectiveProjectPath: (
    text: string,
    options: DelegationOptions,
  ) => {
    projectPath: string | null;
    source: string;
  };
  recordTaskCreationAudit: (payload: any) => void;
  appendTaskLog: (taskId: string, source: string, message: string) => void;
  broadcast: (event: string, payload: unknown) => void;
  l: (ko: string[], en: string[], ja?: string[], zh?: string[]) => L10n;
  pickL: (pool: L10n, lang: Lang) => string;
  notifyCeo: (content: string, taskId?: string | null, messageType?: string) => void;
  isTaskWorkflowInterrupted: (taskId: string) => boolean;
  hasOpenForeignSubtasks: (taskId: string, targetDeptIds?: string[]) => boolean;
  processSubtaskDelegations: (taskId: string, opts?: { includeRender?: boolean }) => void;
  startCrossDeptCooperation: (
    mentionedDepts: string[],
    index: number,
    context: {
      teamLeader: AgentRow;
      taskTitle: string;
      ceoMessage: string;
      leaderDeptId: string;
      leaderDeptName: string;
      leaderName: string;
      lang: Lang;
      taskId: string;
      projectId?: string | null;
      projectCandidateAgentIds?: string[] | null;
    },
    onComplete?: () => void,
  ) => void;
  seedApprovedPlanSubtasks: (taskId: string, leaderDeptId: string, planningNotes: string[]) => void;
  startPlannedApprovalMeeting: (
    taskId: string,
    taskTitle: string,
    leaderDeptId: string,
    onApproved: (planningNotes: string[]) => void,
  ) => void;
  sendAgentMessage: (
    agent: AgentRow,
    content: string,
    messageType?: string,
    receiverType?: string,
    receiverId?: string | null,
    taskId?: string | null,
  ) => void;
  registerTaskMessengerRoute: (taskId: string, options?: DelegationOptions) => void;
  startTaskExecutionForAgent: (taskId: string, agent: AgentRow, leaderDeptId: string, leaderDeptName: string) => void;
}

// ---------------------------------------------------------------------------
// Tier-based org node routing helpers
// ---------------------------------------------------------------------------

interface OrgNodeInfo {
  id: string;
  tier: number;
  name: string;
  parent_id: string | null;
  department_id: string | null;
}

/**
 * Get the org node info for an agent
 */
function getAgentOrgNode(db: RuntimeContext["db"], agentId: string): OrgNodeInfo | null {
  try {
    const row = db.prepare(`
      SELECT on2.id, on2.tier, on2.name, on2.parent_id, on2.department_id
      FROM agents a
      LEFT JOIN org_nodes on2 ON a.org_node_id = on2.id
      WHERE a.id = ?
    `).get(agentId) as OrgNodeInfo | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Find the secretary node (tier=1) for a department under SuperCEO
 * This handles tier=0 -> tier=1 automatic delegation
 */
function findSecretaryNodeForDept(db: RuntimeContext["db"], deptId: string): OrgNodeInfo | null {
  try {
    // Find the tier=1 node (secretary) that is under SuperCEO and belongs to this department
    const row = db.prepare(`
      SELECT id, tier, name, parent_id, department_id
      FROM org_nodes
      WHERE department_id = ? AND tier = 1
      LIMIT 1
    `).get(deptId) as OrgNodeInfo | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Log task flow for org hierarchy tracking, update current_org_node_id, and broadcast.
 */
function logTaskFlow(
  db: RuntimeContext["db"],
  taskId: string,
  fromNodeId: string | null,
  toNodeId: string,
  instructions: string,
  broadcast?: (event: string, payload: unknown) => void,
  status: string = "delegated",
): void {
  try {
    const logId = randomUUID();
    const t = Date.now();
    db.prepare(`
      INSERT INTO task_flow_logs (id, task_id, from_node_id, to_node_id, instructions, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(logId, taskId, fromNodeId, toNodeId, instructions, status, t);
    // Update current_org_node_id to reflect where the task currently is
    db.prepare("UPDATE tasks SET current_org_node_id = ?, updated_at = ? WHERE id = ?").run(toNodeId, t, taskId);
    if (broadcast) {
      broadcast("task_flow_update", {
        id: logId,
        task_id: taskId,
        from_node_id: fromNodeId,
        to_node_id: toNodeId,
        instructions,
        status,
        created_at: t,
      });
    }
  } catch {
    // Best effort - task_flow_logs may not exist yet
  }
}

/**
 * Find the agent bound to an org node
 */
function findAgentForOrgNode(db: RuntimeContext["db"], nodeId: string): AgentRow | null {
  try {
    const row = db.prepare(`
      SELECT a.* FROM agents a
      JOIN org_nodes n ON n.agent_id = a.id
      WHERE n.id = ?
    `).get(nodeId) as AgentRow | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

export function createTaskDelegationHandler(deps: TaskDelegationDeps) {
  function inferPackKeyFromAgentId(agentId: string | null | undefined): string | null {
    const normalized = String(agentId ?? "").trim();
    if (!normalized) return null;
    const matched = normalized.match(/^([a-z0-9_]+)-seed-\d+$/i);
    if (!matched?.[1]) return null;
    const candidate = matched[1].toLowerCase();
    return isWorkflowPackKey(candidate) ? candidate : null;
  }

  const {
    db,
    nowMs,
    resolveLang,
    getDeptName,
    getRoleLabel,
    detectTargetDepartments,
    findBestSubordinate,
    normalizeTextField,
    resolveProjectFromOptions,
    buildRoundGoal,
    resolveDirectiveProjectPath,
    recordTaskCreationAudit,
    appendTaskLog,
    broadcast,
    l,
    pickL,
    notifyCeo,
    isTaskWorkflowInterrupted,
    hasOpenForeignSubtasks,
    processSubtaskDelegations,
    startCrossDeptCooperation,
    seedApprovedPlanSubtasks,
    startPlannedApprovalMeeting,
    sendAgentMessage,
    registerTaskMessengerRoute,
    startTaskExecutionForAgent,
  } = deps;
  function handleTaskDelegation(
    teamLeader: AgentRow,
    ceoMessage: string,
    ceoMsgId: string,
    options: DelegationOptions = {},
  ): void {
    const lang = resolveLang(ceoMessage);
    const leaderName = lang === "ko" ? teamLeader.name_ko || teamLeader.name : teamLeader.name;
    const leaderDeptId = teamLeader.department_id!;
    const leaderDeptName = getDeptName(leaderDeptId);
    const skipPlannedMeeting = !!options.skipPlannedMeeting;
    const skipPlanSubtasks = !!options.skipPlanSubtasks;

    // --- Step 1: Team leader acknowledges (1~2 sec) ---
    const ackDelay = 1000 + Math.random() * 1000;
    setTimeout(() => {
      const selectedProject = resolveProjectFromOptions(options);
      const explicitPackKey = inferPackKeyFromAgentId(teamLeader.id);
      const workflowPackKey = resolveWorkflowPackKeyForTask({
        db: db as any,
        explicitPackKey,
        projectId: selectedProject.id,
      });
      const projectCandidateAgentIds = resolveConstrainedAgentScopeForTask(db as any, {
        workflow_pack_key: workflowPackKey,
        department_id: leaderDeptId,
        project_id: selectedProject.id,
      });
      const subordinate = findBestSubordinate(leaderDeptId, teamLeader.id, projectCandidateAgentIds);
      const manualFallbackToLeader = Array.isArray(projectCandidateAgentIds) && subordinate === null;

      const taskId = randomUUID();
      const t = nowMs();
      const taskTitle = ceoMessage.length > 60 ? ceoMessage.slice(0, 57) + "..." : ceoMessage;
      const projectContextHint = normalizeTextField(options.projectContext) || selectedProject.coreGoal;
      const roundGoal = buildRoundGoal(selectedProject.coreGoal, ceoMessage);
      const { projectPath: detectedPathRaw, source: projectPathSource } = resolveDirectiveProjectPath(ceoMessage, {
        ...options,
        projectPath: options.projectPath ?? selectedProject.projectPath,
        projectContext: projectContextHint,
      });
      const detectedPath = detectedPathRaw || selectedProject.projectPath || null;
      const taskDescriptionLines = [`[CEO] ${ceoMessage}`];
      if (selectedProject.name) taskDescriptionLines.push(`[PROJECT] ${selectedProject.name}`);
      if (selectedProject.coreGoal) taskDescriptionLines.push(`[PROJECT CORE GOAL] ${selectedProject.coreGoal}`);
      taskDescriptionLines.push(`[ROUND GOAL] ${roundGoal}`);
      if (projectContextHint && projectContextHint !== selectedProject.coreGoal) {
        taskDescriptionLines.push(`[PROJECT CONTEXT] ${projectContextHint}`);
      }
      db.prepare(
        `
      INSERT INTO tasks (id, title, description, department_id, assigned_agent_id, project_id, status, priority, task_type, workflow_pack_key, project_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'planned', 1, 'general', ?, ?, ?, ?)
    `,
      ).run(
        taskId,
        taskTitle,
        taskDescriptionLines.join("\n"),
        leaderDeptId,
        teamLeader.id,
        selectedProject.id,
        workflowPackKey,
        detectedPath,
        t,
        t,
      );

      // --- Tier-based org node tracking ---
      const initiatorOrgNode = getAgentOrgNode(db, teamLeader.id);
      const initiatorNodeId = initiatorOrgNode?.id ?? null;
      let currentNodeId: string | null = initiatorNodeId;

      // tier=0 (SuperCEO) task: auto-route to department secretary (tier=1)
      if (initiatorOrgNode && initiatorOrgNode.tier === 0) {
        const secretaryNode = findSecretaryNodeForDept(db, leaderDeptId);
        if (secretaryNode) {
          currentNodeId = secretaryNode.id;
          appendTaskLog(taskId, "system", `[OrgRouting] SuperCEO → ${secretaryNode.name} (tier=1): Auto-route to secretary`);
          logTaskFlow(db, taskId, initiatorNodeId, secretaryNode.id, `Auto-delegated from SuperCEO to ${secretaryNode.name}`, broadcast, "delegated");
          // Notify secretary agent if one is bound to this node
          const secretaryAgent = findAgentForOrgNode(db, secretaryNode.id);
          if (secretaryAgent) {
            const secName = lang === "ko" ? secretaryAgent.name_ko || secretaryAgent.name : secretaryAgent.name;
            sendAgentMessage(
              secretaryAgent,
              pickL(
                l(
                  [`[조직 라우팅] CEO로부터 '${taskTitle}' 업무가 배정되었습니다. 팀장에게 하달합니다.`],
                  [`[Org Routing] Task '${taskTitle}' delegated from CEO. Forwarding to team leader.`],
                  [`[組織ルーティング] CEO から '${taskTitle}' が委任されました。チームリーダーへ下達します。`],
                  [`[组织路由] CEO已将'${taskTitle}'委派给您，正在向组长下达。`],
                ),
                lang,
              ),
              "chat",
              "agent",
              null,
              taskId,
            );
            appendTaskLog(taskId, "system", `[OrgRouting] Secretary agent notified: ${secName}`);
          }
        }
      }

      // Update task with org node tracking fields (initiator_org_node_id only; current_org_node_id is managed by logTaskFlow)
      db.prepare("UPDATE tasks SET initiator_org_node_id = ?, updated_at = ? WHERE id = ?").run(
        initiatorNodeId,
        t,
        taskId,
      );
      // If no secretary hop occurred, set current_org_node_id to initiator
      if (currentNodeId === initiatorNodeId) {
        db.prepare("UPDATE tasks SET current_org_node_id = ?, updated_at = ? WHERE id = ?").run(initiatorNodeId, t, taskId);
      }

      if (currentNodeId && currentNodeId !== initiatorNodeId) {
        appendTaskLog(taskId, "system", `[OrgRouting] current_node_id = ${currentNodeId}`);
      }
      registerTaskMessengerRoute(taskId, options);
      recordTaskCreationAudit({
        taskId,
        taskTitle,
        taskStatus: "planned",
        departmentId: leaderDeptId,
        assignedAgentId: teamLeader.id,
        taskType: "general",
        projectPath: detectedPath ?? null,
        trigger: "workflow.delegation.ceo_message",
        triggerDetail: `skip_planned_meeting=${skipPlannedMeeting}; skip_plan_subtasks=${skipPlanSubtasks}`,
        actorType: "agent",
        actorId: teamLeader.id,
        actorName: teamLeader.name,
        body: {
          ceo_message: ceoMessage,
          options: {
            skip_planned_meeting: skipPlannedMeeting,
            skip_plan_subtasks: skipPlanSubtasks,
            project_id: selectedProject.id,
            project_context: projectContextHint,
            round_goal: roundGoal,
          },
        },
      });
      if (selectedProject.id) {
        db.prepare("UPDATE projects SET last_used_at = ?, updated_at = ? WHERE id = ?").run(t, t, selectedProject.id);
      }
      appendTaskLog(taskId, "system", `CEO → ${leaderName}: ${ceoMessage}`);
      if (selectedProject.id) {
        appendTaskLog(taskId, "system", `Project linked: ${selectedProject.name || selectedProject.id}`);
      }
      appendTaskLog(taskId, "system", `Round goal: ${roundGoal}`);
      if (detectedPath) {
        appendTaskLog(taskId, "system", `Project path resolved (${projectPathSource}): ${detectedPath}`);
      }
      if (projectContextHint) {
        appendTaskLog(taskId, "system", `Project context hint: ${projectContextHint}`);
      }
      if (manualFallbackToLeader) {
        appendTaskLog(
          taskId,
          "system",
          `Manual assignment fallback: no eligible subordinate found among ${(projectCandidateAgentIds ?? []).length} assigned agent(s). Team leader will execute.`,
        );
      }

      broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));

      const mentionedDepts = [...new Set(detectTargetDepartments(ceoMessage).filter((d) => d !== leaderDeptId))];
      const isPlanningLead =
        leaderDeptId === "planning" ||
        Number((teamLeader as unknown as { acts_as_planning_leader?: unknown }).acts_as_planning_leader ?? 0) === 1;

      if (isPlanningLead) {
        const relatedLabel =
          mentionedDepts.length > 0
            ? mentionedDepts.map(getDeptName).join(", ")
            : pickL(l(["없음"], ["None"], ["なし"], ["无"]), lang);
        appendTaskLog(taskId, "system", `Planning pre-check related departments: ${relatedLabel}`);
        notifyCeo(
          pickL(
            l(
              [`[기획팀] '${taskTitle}' 유관부서 사전 파악 완료: ${relatedLabel}`],
              [`[Planning] Related departments identified for '${taskTitle}': ${relatedLabel}`],
              [`[企画] '${taskTitle}' の関連部門の事前把握が完了: ${relatedLabel}`],
              [`[企划] 已完成'${taskTitle}'相关部门预识别：${relatedLabel}`],
            ),
            lang,
          ),
          taskId,
        );
      }

      const runCrossDeptBeforeDelegationIfNeeded = (next: () => void) => {
        if (isTaskWorkflowInterrupted(taskId)) return;
        if (!(isPlanningLead && mentionedDepts.length > 0)) {
          next();
          return;
        }

        const crossDeptNames = mentionedDepts.map(getDeptName).join(", ");
        if (hasOpenForeignSubtasks(taskId, mentionedDepts)) {
          notifyCeo(
            pickL(
              l(
                [`[CEO OFFICE] 기획팀 선행 협업을 서브태스크 통합 디스패처로 실행합니다: ${crossDeptNames}`],
                [`[CEO OFFICE] Running planning pre-collaboration via unified subtask dispatcher: ${crossDeptNames}`],
                [`[CEO OFFICE] 企画先行協業を統合サブタスクディスパッチャで実行します: ${crossDeptNames}`],
                [`[CEO OFFICE] 企划前置协作改为统一 SubTask 调度执行：${crossDeptNames}`],
              ),
              lang,
            ),
            taskId,
          );
          appendTaskLog(
            taskId,
            "system",
            `Planning pre-collaboration unified to batched subtask dispatch (${crossDeptNames})`,
          );
          processSubtaskDelegations(taskId);
          next();
          return;
        }

        notifyCeo(
          pickL(
            l(
              [`[CEO OFFICE] 기획팀 선행 협업 처리 시작: ${crossDeptNames}`],
              [`[CEO OFFICE] Planning pre-collaboration started with: ${crossDeptNames}`],
              [`[CEO OFFICE] 企画チームの先行協業を開始: ${crossDeptNames}`],
              [`[CEO OFFICE] 企划团队前置协作已启动：${crossDeptNames}`],
            ),
            lang,
          ),
          taskId,
        );
        // Mark original task as 'collaborating' while cross-dept work proceeds
        db.prepare("UPDATE tasks SET status = 'collaborating', updated_at = ? WHERE id = ?").run(nowMs(), taskId);
        broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));

        startCrossDeptCooperation(
          mentionedDepts,
          0,
          {
            teamLeader,
            taskTitle,
            ceoMessage,
            leaderDeptId,
            leaderDeptName,
            leaderName,
            lang,
            taskId,
            projectId: selectedProject.id,
            projectCandidateAgentIds,
          },
          () => {
            if (isTaskWorkflowInterrupted(taskId)) return;
            notifyCeo(
              pickL(
                l(
                  ["[CEO OFFICE] 유관부서 선행 처리 완료. 이제 내부 업무 하달을 시작합니다."],
                  ["[CEO OFFICE] Related-department pre-processing complete. Starting internal delegation now."],
                  ["[CEO OFFICE] 関連部門の先行処理が完了。これより内部委任を開始します。"],
                  ["[CEO OFFICE] 相关部门前置处理完成，现开始内部下达。"],
                ),
                lang,
              ),
              taskId,
            );
            next();
          },
        );
      };

      const runCrossDeptAfterMainIfNeeded = () => {
        if (isPlanningLead || mentionedDepts.length === 0) return;
        const crossDelay = 3000 + Math.random() * 1000;
        setTimeout(() => {
          if (isTaskWorkflowInterrupted(taskId)) return;
          if (hasOpenForeignSubtasks(taskId, mentionedDepts)) {
            appendTaskLog(
              taskId,
              "system",
              `Cross-dept collaboration unified to batched subtask dispatch (${mentionedDepts.map(getDeptName).join(", ")})`,
            );
            processSubtaskDelegations(taskId);
            return;
          }
          // Only set 'collaborating' if the task hasn't already moved to 'in_progress' (avoid status regression)
          const currentTask = db.prepare("SELECT status FROM tasks WHERE id = ?").get(taskId) as
            | { status: string }
            | undefined;
          if (currentTask && currentTask.status !== "in_progress") {
            db.prepare("UPDATE tasks SET status = 'collaborating', updated_at = ? WHERE id = ?").run(nowMs(), taskId);
            broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
          }
          startCrossDeptCooperation(mentionedDepts, 0, {
            teamLeader,
            taskTitle,
            ceoMessage,
            leaderDeptId,
            leaderDeptName,
            leaderName,
            lang,
            taskId,
            projectId: selectedProject.id,
            projectCandidateAgentIds,
          });
        }, crossDelay);
      };

      const runPlanningPhase = (afterPlan: () => void) => {
        if (isTaskWorkflowInterrupted(taskId)) return;
        if (skipPlannedMeeting) {
          appendTaskLog(taskId, "system", "Planned meeting skipped by CEO directive");
          if (!skipPlanSubtasks) {
            seedApprovedPlanSubtasks(taskId, leaderDeptId, []);
          }
          runCrossDeptBeforeDelegationIfNeeded(afterPlan);
          return;
        }
        startPlannedApprovalMeeting(taskId, taskTitle, leaderDeptId, (planningNotes: string[]) => {
          if (isTaskWorkflowInterrupted(taskId)) return;
          if (!skipPlanSubtasks) {
            seedApprovedPlanSubtasks(taskId, leaderDeptId, planningNotes ?? []);
          }
          runCrossDeptBeforeDelegationIfNeeded(afterPlan);
        });
      };

      if (subordinate) {
        const subName = lang === "ko" ? subordinate.name_ko || subordinate.name : subordinate.name;
        const subRole = getRoleLabel(subordinate.role, lang);

        const ackMsg = buildLeaderAckMessage({
          l,
          pickL,
          lang,
          subRole,
          subName,
          skipPlannedMeeting,
          isPlanningLead,
          crossDeptNames: mentionedDepts.map(getDeptName).join(", "),
        });
        sendAgentMessage(teamLeader, ackMsg, "chat", "agent", null, taskId);

        const delegateToSubordinate = () => {
          // --- Step 2: Delegate to subordinate (2~3 sec) ---
          const delegateDelay = 2000 + Math.random() * 1000;
          setTimeout(() => {
            if (isTaskWorkflowInterrupted(taskId)) return;
            const t2 = nowMs();
            db.prepare("UPDATE tasks SET assigned_agent_id = ?, status = 'planned', updated_at = ? WHERE id = ?").run(
              subordinate.id,
              t2,
              taskId,
            );
            db.prepare("UPDATE agents SET current_task_id = ? WHERE id = ?").run(taskId, subordinate.id);
            appendTaskLog(taskId, "system", `${leaderName} → ${subName}`);

            // Org node flow tracking: leader → subordinate
            const leaderOrgNode = getAgentOrgNode(db, teamLeader.id);
            const subordinateOrgNode = getAgentOrgNode(db, subordinate.id);
            if (leaderOrgNode && subordinateOrgNode) {
              logTaskFlow(
                db,
                taskId,
                leaderOrgNode.id,
                subordinateOrgNode.id,
                `${leaderName} delegated to ${subName}`,
                broadcast,
                "delegated",
              );
              appendTaskLog(taskId, "system", `[OrgRouting] ${leaderOrgNode.name} (tier=${leaderOrgNode.tier}) → ${subordinateOrgNode.name} (tier=${subordinateOrgNode.tier})`);
            }

            broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
            broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(subordinate.id));

            const delegateMsg = buildDelegateMessage({ l, pickL, lang, subName, ceoMessage });
            sendAgentMessage(teamLeader, delegateMsg, "task_assign", "agent", subordinate.id, taskId);

            // --- Step 3: Subordinate acknowledges (1~2 sec) ---
            const subAckDelay = 1000 + Math.random() * 1000;
            setTimeout(() => {
              if (isTaskWorkflowInterrupted(taskId)) return;
              const leaderRole = getRoleLabel(teamLeader.role, lang);
              const subAckMsg = buildSubordinateAckMessage({ l, pickL, lang, leaderRole, leaderName });
              sendAgentMessage(subordinate, subAckMsg, "chat", "agent", null, taskId);
              startTaskExecutionForAgent(taskId, subordinate, leaderDeptId, leaderDeptName);
              runCrossDeptAfterMainIfNeeded();
            }, subAckDelay);
          }, delegateDelay);
        };

        runPlanningPhase(delegateToSubordinate);
      } else {
        // No subordinate — team leader handles it themselves
        if (manualFallbackToLeader) {
          notifyCeo(buildManualFallbackNotice({ l, pickL, lang, leaderName }), taskId);
        }
        const selfMsg = buildSelfExecutionMessage({ l, pickL, lang, skipPlannedMeeting });
        sendAgentMessage(teamLeader, selfMsg, "chat", "agent", null, taskId);

        const t2 = nowMs();
        db.prepare("UPDATE tasks SET assigned_agent_id = ?, status = 'planned', updated_at = ? WHERE id = ?").run(
          teamLeader.id,
          t2,
          taskId,
        );
        db.prepare("UPDATE agents SET current_task_id = ? WHERE id = ?").run(taskId, teamLeader.id);
        appendTaskLog(taskId, "system", `${leaderName} self-assigned (planned)`);

        broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
        broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(teamLeader.id));

        runPlanningPhase(() => {
          if (isTaskWorkflowInterrupted(taskId)) return;
          startTaskExecutionForAgent(taskId, teamLeader, leaderDeptId, leaderDeptName);
          runCrossDeptAfterMainIfNeeded();
        });
      }
    }, ackDelay);
  }

  return handleTaskDelegation;
}

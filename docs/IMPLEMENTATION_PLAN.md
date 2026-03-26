# Claw-Empire 多 Agent 协作系统实施文档

> 文档版本：v1.0  
> 生成日期：2026-03-24  
> 项目版本：v2.0.4

---

## 📋 目录

1. [项目概述](#项目概述)
2. [组织架构设计](#组织架构设计)
3. [核心模块实施](#核心模块实施)
4. [数据库 Schema 设计](#数据库-schema 设计)
5. [API 接口设计](#api 接口设计)
6. [前端组件设计](#前端组件设计)
7. [实施路线图](#实施路线图)
8. [测试策略](#测试策略)

---

## 项目概述

### 项目背景

Claw-Empire 是一个多 Agent 协作的虚拟公司模拟系统，通过层级化的组织架构（SuperCEO > 秘书 > 部长 > 员工）实现任务的智能分发和执行。

### 核心需求

1. **组织架构管理**
   - SuperCEO（唯一根节点）：战略决策和用户交互
   - 秘书（Tier 1）：任务拆解、记忆管理、跨部门协调
   - 部长（Tier 2）：任务细分、进度监督
   - 员工（Tier 3）：具体任务执行

2. **记忆管理系统**
   - 秘书专属记忆文件（Agents.md、soul.md、memory.md）
   - 4 小时定时记忆提炼任务
   - 防止记忆文件过大

3. **任务分发系统**
   - 智能任务路由（基于部门、技能、负载）
   - 任务优先级管理（5 级）
   - 任务状态跟踪

4. **工作流系统**
   - 可视化工作流编辑器
   - 工作流状态管理（草稿/已发布）
   - 负责人绑定机制

5. **可视化监控**
   - 像素风办公室视图（明亮/暗黑主题）
   - 实时工作状态展示
   - 全员公告实时监控

---

## 组织架构设计

### 层级结构

```
Tier 0: SuperCEO (👑)
  │
  └─ Tier 1: Secretary (📋) - 每个办公室必须有一个秘书
       │
       └─ Tier 2: Leader (👥) - 每个部门必须有一个部长
            │
            └─ Tier 3: Agent (⚡) - 员工
```

### 核心概念

| 概念 | 说明 | 约束 |
|------|------|------|
| **SuperCEO** | 公司最高决策者，直接对接用户 | 有且仅有一个 |
| **办公室** | 由秘书管理的独立业务单元 | 必须绑定一个秘书 |
| **部门** | 由部长领导的功能团队 | 必须绑定一个部长 |
| **员工** | 执行具体任务的 Agent | 可属于任意部门 |

### 组织节点类型定义

```typescript
// src/types/org-nodes.ts
export type OrgNodeTier = 0 | 1 | 2 | 3;

export interface OrgNode {
  id: string;
  name: string;
  name_ko: string;
  name_ja: string;
  name_zh: string;
  tier: OrgNodeTier;
  parent_id: string | null;
  department_id: string | null;
  agent_id: string | null;
  metadata_json: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export const TIER_CONFIG: Record<OrgNodeTier, {
  label: { en: string; ko: string; ja: string; zh: string };
  icon: string;
  color: { light: string; dark: string };
}> = {
  0: {
    label: { en: "SuperCEO", ko: "슈퍼 CEO", ja: "最高 CEO", zh: "超级 CEO" },
    icon: "👑",
    color: { light: "#D97706", dark: "#F59E0B" },
  },
  1: {
    label: { en: "Secretary", ko: "비서", ja: "秘書", zh: "秘书" },
    icon: "📋",
    color: { light: "#7C3AED", dark: "#8B5CF6" },
  },
  2: {
    label: { en: "Leader", ko: "리더", ja: "リーダー", zh: "组长" },
    icon: "👥",
    color: { light: "#0891B2", dark: "#06B6D4" },
  },
  3: {
    label: { en: "Agent", ko: "에이전트", ja: "エージェント", zh: "员工" },
    icon: "⚡",
    color: { light: "#F97316", dark: "#FB923C" },
  },
};
```

---

## 核心模块实施

### 1. 记忆管理系统

#### 1.1 秘书专属记忆页面

**文件位置**: `src/components/MemoryManager.tsx`

**功能需求**:
- 展示所有秘书列表
- 对每个秘书的三个文件进行编辑：
  - `Agents.md` - 角色设定
  - `soul.md` - 核心性格与价值观
  - `memory.md` - 动态记忆内容

**组件结构**:

```tsx
interface MemoryManagerProps {
  secretaries: Agent[];
  onFileUpdate: (agentId: string, fileType: string, content: string) => Promise<void>;
}

export const MemoryManager: React.FC<MemoryManagerProps> = ({ secretaries, onFileUpdate }) => {
  const [selectedSecretary, setSelectedSecretary] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'agents' | 'soul' | 'memory'>('memory');
  const [content, setContent] = useState('');
  
  // 实现逻辑...
};
```

#### 1.2 记忆提炼定时任务

**文件位置**: `server/modules/memory-purge.ts`

**实现逻辑**:

```typescript
import { readNonNegativeIntEnv } from "./db/runtime.ts";

// 4 小时检查周期
export const MEMORY_PURGE_INTERVAL_MS = readNonNegativeIntEnv("MEMORY_PURGE_INTERVAL_MS", 4 * 60 * 60 * 1000);

export function startMemoryPurgeService(db: DatabaseSync, broadcast: any) {
  console.log(`[MemoryPurge] Starting service with interval: ${MEMORY_PURGE_INTERVAL_MS}ms`);
  
  setInterval(async () => {
    try {
      // 1. 获取所有秘书的记忆文件
      const memoryFiles = db.prepare(`
        SELECT id, agent_id, file_type, content, updated_at
        FROM memory_files
        WHERE file_type = 'memory'
      `).all();

      // 2. 检查每个文件是否需要提炼
      for (const file of memoryFiles) {
        const fileSize = new TextEncoder().encode(file.content).length;
        
        // 超过 50KB 需要提炼
        if (fileSize > 50 * 1024) {
          await compactMemoryFile(db, broadcast, file);
        }
      }
      
      console.log(`[MemoryPurge] Completed purge cycle at ${new Date().toISOString()}`);
    } catch (error) {
      console.error("[MemoryPurge] Error during purge cycle:", error);
    }
  }, MEMORY_PURGE_INTERVAL_MS);
}

async function compactMemoryFile(db: DatabaseSync, broadcast: any, file: any) {
  // 调用 memory-manager skill 进行提炼
  // 保存提炼后的内容
  // 记录版本历史
}
```

#### 1.3 记忆文件结构

```markdown
## 用户信息

### 基本信息
- 姓名：[用户姓名]
- 职业：[用户职业]
- 所在地：[用户所在地]
- 技术栈：[技术栈偏好]

### 项目背景
- 项目名称：[项目名称]
- 核心目标：[项目目标]
- 当前阶段：[项目阶段]

## 对话摘要

- YYYY-MM-DD: [核心决策与结论]
- YYYY-MM-DD: [重要任务完成情况]

## 关键偏好

### 代码风格
- 偏好简洁代码，注释适度
- 喜欢使用函数式编程范式

### 沟通方式
- 喜欢直接了当的沟通
- 重视数据驱动的决策

### 工作流程
- 偏好先规划后执行
- 重视代码审查和测试

## 待办事项

### 长期任务
- [ ] [任务描述] - 截止日期：YYYY-MM-DD

### 跨会话跟踪
- [进行中] [任务名称] - 上次进展：[进展描述]
```

---

### 2. 任务分发系统

#### 2.1 任务分发秘书角色

**文件位置**: `server/modules/routes/core/tasks/task-dispatcher.ts`

**智能匹配算法**:

```typescript
interface DispatchCriteria {
  task: Task;
  availableAgents: Agent[];
  departments: Department[];
}

interface AgentScore {
  agentId: string;
  score: number;
  factors: {
    departmentMatch: number;      // 部门匹配度 (0-1)
    skillMatch: number;           // 技能匹配度 (0-1)
    workloadScore: number;        // 负载分数 (0-1, 越低越好)
    performanceScore: number;     // 历史绩效 (0-1)
  };
}

export function calculateAgentScores(criteria: DispatchCriteria): AgentScore[] {
  const { task, availableAgents, departments } = criteria;
  
  return availableAgents.map(agent => {
    const deptMatch = calculateDepartmentMatch(agent, task, departments);
    const skillMatch = calculateSkillMatch(agent, task);
    const workload = calculateWorkload(agent);
    const performance = calculatePerformance(agent);
    
    // 加权计算总分
    const totalScore = 
      deptMatch * 0.3 +
      skillMatch * 0.3 +
      (1 - workload) * 0.2 +
      performance * 0.2;
    
    return {
      agentId: agent.id,
      score: totalScore,
      factors: {
        departmentMatch: deptMatch,
        skillMatch: skillMatch,
        workloadScore: workload,
        performanceScore: performance,
      }
    };
  }).sort((a, b) => b.score - a.score);
}

function calculateDepartmentMatch(agent: Agent, task: Task, departments: Department[]): number {
  if (!agent.department_id || !task.department_id) return 0.5;
  return agent.department_id === task.department_id ? 1.0 : 0.3;
}

function calculateSkillMatch(agent: Agent, task: Task): number {
  // 从 agent 的 personality 或 metadata 中提取技能信息
  // 与 task_type 进行匹配
  return 0.7; // 示例
}

function calculateWorkload(agent: Agent): number {
  // 计算当前 agent 的任务负载
  // 返回 0-1 之间的值
  return 0.5; // 示例
}

function calculatePerformance(agent: Agent): number {
  // 基于历史完成任务的质量和速度
  const baseScore = agent.stats_tasks_done > 0 ? Math.min(agent.stats_tasks_done / 10, 1) : 0.5;
  const xpBonus = Math.min(agent.stats_xp / 1000, 0.2);
  return Math.min(baseScore + xpBonus, 1);
}
```

#### 2.2 任务分发看板

**文件位置**: `src/components/TaskDispatchBoard.tsx`

```tsx
interface TaskDispatchBoardProps {
  pendingTasks: Task[];
  availableAgents: Agent[];
  onAssignTask: (taskId: string, agentId: string) => Promise<void>;
  onBulkAssign: (assignments: { taskId: string; agentId: string }[]) => Promise<void>;
}

export const TaskDispatchBoard: React.FC<TaskDispatchBoardProps> = ({
  pendingTasks,
  availableAgents,
  onAssignTask,
  onBulkAssign,
}) => {
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(true);
  
  const handleAutoAssign = async (task: Task) => {
    const scores = calculateAgentScores({
      task,
      availableAgents,
      departments: [],
    });
    
    if (scores.length > 0) {
      await onAssignTask(task.id, scores[0].agentId);
    }
  };
  
  return (
    <div className="task-dispatch-board">
      <div className="dispatch-header">
        <h2>任务分发中心</h2>
        <label>
          <input
            type="checkbox"
            checked={autoAssignEnabled}
            onChange={(e) => setAutoAssignEnabled(e.target.checked)}
          />
          启用智能分配
        </label>
      </div>
      
      <div className="task-list">
        {pendingTasks.map(task => (
          <TaskDispatchCard
            key={task.id}
            task={task}
            onAutoAssign={() => handleAutoAssign(task)}
            onManualAssign={(agentId) => onAssignTask(task.id, agentId)}
          />
        ))}
      </div>
    </div>
  );
};
```

---

### 3. 工作流系统

#### 3.1 可视化工作流编辑器

**文件位置**: `src/components/WorkflowEditor.tsx`

**依赖**: `@reactflow/core`

```tsx
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface WorkflowNodeData {
  label: string;
  type: 'start' | 'agent' | 'condition' | 'tool' | 'end';
  config?: any;
}

const nodeTypes = {
  start: StartNode,
  agent: AgentNode,
  condition: ConditionNode,
  tool: ToolNode,
  end: EndNode,
};

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ workflow, onSave }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );
  
  const handleSave = () => {
    const workflowData = {
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
      })),
    };
    
    onSave(workflowData);
  };
  
  return (
    <div className="workflow-editor">
      <div className="editor-toolbar">
        <button onClick={handleSave}>保存工作流</button>
        <button onClick={handlePublish}>发布</button>
      </div>
      
      <div className="editor-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
};
```

#### 3.2 工作流状态机

```typescript
type WorkflowStatus = 'draft' | 'published' | 'running' | 'completed' | 'paused';

interface WorkflowStateMachine {
  currentStatus: WorkflowStatus;
  transitions: Record<WorkflowStatus, WorkflowStatus[]>;
}

export const workflowStateMachine: WorkflowStateMachine = {
  currentStatus: 'draft',
  transitions: {
    draft: ['published', 'draft'],
    published: ['running', 'draft'],
    running: ['completed', 'paused', 'failed'],
    completed: ['draft'],
    paused: ['running', 'draft'],
    failed: ['draft'],
  },
};

export function canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return workflowStateMachine.transitions[from]?.includes(to) ?? false;
}
```

---

## 数据库 Schema 设计

### 完整 Schema

```sql
-- 1. 办公室表
CREATE TABLE IF NOT EXISTS offices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ko TEXT NOT NULL,
  name_ja TEXT NOT NULL DEFAULT '',
  name_zh TEXT NOT NULL DEFAULT '',
  secretary_agent_id TEXT REFERENCES agents(id),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 99,
  created_at INTEGER DEFAULT (unixepoch()*1000),
  updated_at INTEGER DEFAULT (unixepoch()*1000)
);

-- 2. 记忆文件表
CREATE TABLE IF NOT EXISTS memory_files (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  file_type TEXT NOT NULL CHECK(file_type IN ('agents', 'soul', 'memory')),
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  last_compacted_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()*1000),
  updated_at INTEGER DEFAULT (unixepoch()*1000),
  UNIQUE(agent_id, file_type)
);

-- 3. 记忆版本历史
CREATE TABLE IF NOT EXISTS memory_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_file_id TEXT NOT NULL REFERENCES memory_files(id),
  content_snapshot TEXT NOT NULL,
  version_note TEXT,
  created_at INTEGER DEFAULT (unixepoch()*1000)
);

-- 4. 工具库表
CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tool_type TEXT NOT NULL CHECK(tool_type IN ('skill', 'mcp')),
  category TEXT,
  description TEXT,
  config_json TEXT,
  version TEXT DEFAULT '1.0.0',
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()*1000),
  updated_at INTEGER DEFAULT (unixepoch()*1000)
);

-- 5. 代理工具绑定表
CREATE TABLE IF NOT EXISTS agent_tools (
  agent_id TEXT NOT NULL REFERENCES agents(id),
  tool_id TEXT NOT NULL REFERENCES tools(id),
  priority INTEGER NOT NULL DEFAULT 99,
  created_at INTEGER DEFAULT (unixepoch()*1000),
  PRIMARY KEY (agent_id, tool_id)
);

-- 6. 公告表
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  sender_type TEXT NOT NULL CHECK(sender_type IN ('ceo', 'secretary', 'system')),
  sender_id TEXT,
  content TEXT NOT NULL,
  broadcast_type TEXT NOT NULL CHECK(broadcast_type IN ('all', 'department', 'targeted')),
  target_ids TEXT,  -- JSON 数组
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_read INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()*1000)
);

-- 7. 定时任务表
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY,
  task_name TEXT NOT NULL,
  task_description TEXT,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('interval', 'cron')),
  trigger_config TEXT NOT NULL,  -- JSON 配置
  target_secretary_ids TEXT,  -- JSON 数组，支持"all"
  action_type TEXT NOT NULL,
  action_config TEXT NOT NULL,  -- JSON 配置
  is_enabled INTEGER NOT NULL DEFAULT 1,
  last_executed_at INTEGER,
  last_execution_result TEXT,
  next_execution_at INTEGER,
  execution_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()*1000),
  updated_at INTEGER DEFAULT (unixepoch()*1000)
);

-- 8. 任务分发日志表
CREATE TABLE IF NOT EXISTS task_dispatch_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  dispatcher_agent_id TEXT REFERENCES agents(id),
  assigned_agent_id TEXT REFERENCES agents(id),
  dispatch_reason TEXT,  -- 分配原因说明
  match_scores TEXT,  -- JSON 格式存储各维度分数
  created_at INTEGER DEFAULT (unixepoch()*1000)
);

-- 9. 工作流执行历史表
CREATE TABLE IF NOT EXISTS workflow_execution_history (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  task_id TEXT REFERENCES tasks(id),
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  execution_log TEXT,  -- JSON 格式存储执行日志
  error_message TEXT,
  created_at INTEGER DEFAULT (unixepoch()*1000)
);

-- 10. 员工工作状态表
CREATE TABLE IF NOT EXISTS agent_work_states (
  agent_id TEXT PRIMARY KEY REFERENCES agents(id),
  current_task_id TEXT REFERENCES tasks(id),
  status TEXT NOT NULL CHECK(status IN ('idle', 'working', 'break', 'offline')),
  status_message TEXT,
  last_status_change_at INTEGER,
  work_start_time INTEGER,
  break_start_time INTEGER,
  metadata_json TEXT,
  updated_at INTEGER DEFAULT (unixepoch()*1000)
);
```

---

## API 接口设计

### 1. 记忆管理 API

```typescript
// server/modules/routes/core/memories.ts

interface MemoryRoutes {
  // 获取秘书的记忆文件
  'GET /api/memories/:agentId/:fileType': {
    response: {
      ok: boolean;
      file_type: string;
      content: string;
      version: number;
      updated_at: number;
    };
  };
  
  // 更新记忆文件
  'PATCH /api/memories/:agentId/:fileType': {
    body: {
      content: string;
      version_note?: string;
    };
    response: {
      ok: boolean;
      version: number;
    };
  };
  
  // 获取记忆版本历史
  'GET /api/memories/:agentId/:fileType/versions': {
    response: {
      ok: boolean;
      versions: Array<{
        version: number;
        created_at: number;
        version_note: string;
        size_bytes: number;
      }>;
    };
  };
  
  // 回滚到指定版本
  'POST /api/memories/:agentId/:fileType/rollback/:version': {
    response: {
      ok: boolean;
    };
  };
  
  // 记忆提炼（手动触发）
  'POST /api/memories/:agentId/:fileType/compact': {
    response: {
      ok: boolean;
      original_size: number;
      compacted_size: number;
      compression_ratio: number;
    };
  };
}
```

### 2. 任务分发 API

```typescript
// server/modules/routes/core/tasks/dispatch.ts

interface DispatchRoutes {
  // 获取待分配任务列表
  'GET /api/tasks/dispatch/pending': {
    query: {
      department_id?: string;
      priority?: number;
      limit?: number;
    };
    response: {
      ok: boolean;
      tasks: Task[];
      total: number;
    };
  };
  
  // 获取智能分配建议
  'GET /api/tasks/:taskId/dispatch/suggestions': {
    response: {
      ok: boolean;
      suggestions: Array<{
        agent_id: string;
        agent_name: string;
        score: number;
        factors: {
          department_match: number;
          skill_match: number;
          workload: number;
          performance: number;
        };
      }>;
    };
  };
  
  // 手动分配任务
  'POST /api/tasks/:taskId/dispatch': {
    body: {
      agent_id: string;
      dispatch_reason?: string;
    };
    response: {
      ok: boolean;
      task: Task;
    };
  };
  
  // 批量自动分配
  'POST /api/tasks/dispatch/auto': {
    body: {
      task_ids: string[];
      criteria?: {
        min_score?: number;
        max_tasks_per_agent?: number;
      };
    };
    response: {
      ok: boolean;
      assignments: Array<{
        task_id: string;
        agent_id: string;
        score: number;
      }>;
      failed: Array<{
        task_id: string;
        reason: string;
      }>;
    };
  };
}
```

### 3. 工具库管理 API

```typescript
// server/modules/routes/ops/tools.ts

interface ToolRoutes {
  // 获取工具列表
  'GET /api/tools': {
    query: {
      tool_type?: 'skill' | 'mcp';
      category?: string;
      is_enabled?: boolean;
    };
    response: {
      ok: boolean;
      tools: Tool[];
    };
  };
  
  // 创建工具
  'POST /api/tools': {
    body: {
      name: string;
      tool_type: 'skill' | 'mcp';
      category?: string;
      description?: string;
      config_json: string;
    };
    response: {
      ok: boolean;
      tool: Tool;
    };
  };
  
  // 更新工具
  'PATCH /api/tools/:id': {
    body: Partial<Tool>;
    response: {
      ok: boolean;
      tool: Tool;
    };
  };
  
  // 删除工具
  'DELETE /api/tools/:id': {
    response: {
      ok: boolean;
    };
  };
  
  // 获取代理的工具列表
  'GET /api/agents/:agentId/tools': {
    response: {
      ok: boolean;
      tools: Array<Tool & { priority: number }>;
    };
  };
  
  // 为代理分配工具
  'POST /api/agents/:agentId/tools': {
    body: {
      tool_id: string;
      priority?: number;
    };
    response: {
      ok: boolean;
    };
  };
  
  // 移除代理的工具
  'DELETE /api/agents/:agentId/tools/:toolId': {
    response: {
      ok: boolean;
    };
  };
}
```

### 4. 定时任务 API

```typescript
// server/modules/routes/ops/scheduled-tasks.ts

interface ScheduledTaskRoutes {
  // 获取定时任务列表
  'GET /api/scheduled-tasks': {
    response: {
      ok: boolean;
      tasks: ScheduledTask[];
    };
  };
  
  // 创建定时任务
  'POST /api/scheduled-tasks': {
    body: {
      task_name: string;
      task_description?: string;
      trigger_type: 'interval' | 'cron';
      trigger_config: string;  // JSON: { interval_ms: number } 或 { cron_expression: string }
      target_secretary_ids: string;  // JSON: string[] 或 "all"
      action_type: string;
      action_config: string;  // JSON
    };
    response: {
      ok: boolean;
      task: ScheduledTask;
    };
  };
  
  // 更新定时任务
  'PATCH /api/scheduled-tasks/:id': {
    body: Partial<ScheduledTask>;
    response: {
      ok: boolean;
      task: ScheduledTask;
    };
  };
  
  // 删除定时任务
  'DELETE /api/scheduled-tasks/:id': {
    response: {
      ok: boolean;
    };
  };
  
  // 手动触发定时任务
  'POST /api/scheduled-tasks/:id/trigger': {
    response: {
      ok: boolean;
      execution_result: any;
    };
  };
  
  // 获取执行历史
  'GET /api/scheduled-tasks/:id/executions': {
    query: {
      limit?: number;
    };
    response: {
      ok: boolean;
      executions: Array<{
        executed_at: number;
        result: string;
        duration_ms: number;
      }>;
    };
  };
}
```

### 5. 公告 API

```typescript
// server/modules/routes/ops/announcements.ts

interface AnnouncementRoutes {
  // 获取公告列表
  'GET /api/announcements': {
    query: {
      broadcast_type?: 'all' | 'department' | 'targeted';
      is_pinned?: boolean;
      limit?: number;
    };
    response: {
      ok: boolean;
      announcements: Announcement[];
    };
  };
  
  // 创建公告
  'POST /api/announcements': {
    body: {
      content: string;
      broadcast_type: 'all' | 'department' | 'targeted';
      target_ids?: string[];
      is_pinned?: boolean;
      expires_at?: number;
    };
    response: {
      ok: boolean;
      announcement: Announcement;
    };
  };
  
  // 删除公告
  'DELETE /api/announcements/:id': {
    response: {
      ok: boolean;
    };
  };
  
  // 标记公告为已读
  'POST /api/announcements/:id/read': {
    response: {
      ok: boolean;
    };
  };
  
  // 实时公告流（WebSocket）
  'WS /ws/announcements': {
    events: {
      'new_announcement': Announcement;
      'announcement_deleted': { id: string };
    };
  };
}
```

---

## 前端组件设计

### 组件文件结构

```
src/components/
├── MemoryManager.tsx              # 记忆管理
├── TaskDispatchBoard.tsx          # 任务分发看板
├── WorkflowEditor.tsx             # 工作流编辑器
├── ToolLibrary.tsx                # 工具库管理
├── AnnouncementFeed.tsx           # 公告实时监控
├── OfficeManager.tsx              # 办公室管理
├── ScheduledTaskManager.tsx       # 定时任务管理
├── agent-manager/
│   ├── AgentFormModal.tsx         # 代理表单（扩展）
│   └── AgentDetail.tsx            # 代理详情（扩展）
├── office-view/
│   ├── buildScene-multi-floor.ts  # 多层楼场景构建
│   └── useOfficeDeliveryEffects.ts # 办公室效果
└── dashboard/
    ├── KPIPanel.tsx               # KPI 指标面板
    └── TaskProgressPanel.tsx      # 任务进度面板
```

### 关键组件实现

#### OfficeManager.tsx

```tsx
interface OfficeManagerProps {
  offices: Office[];
  secretaries: Agent[];
  onCreateOffice: (data: CreateOfficeData) => Promise<void>;
  onUpdateOffice: (id: string, data: UpdateOfficeData) => Promise<void>;
  onDeleteOffice: (id: string) => Promise<void>;
}

export const OfficeManager: React.FC<OfficeManagerProps> = ({
  offices,
  secretaries,
  onCreateOffice,
  onUpdateOffice,
  onDeleteOffice,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  
  return (
    <div className="office-manager">
      <div className="manager-header">
        <h2>办公室管理</h2>
        <button onClick={() => setIsModalOpen(true)}>
          + 新建办公室
        </button>
      </div>
      
      <div className="office-list">
        {offices.map(office => (
          <OfficeCard
            key={office.id}
            office={office}
            secretary={secretaries.find(s => s.id === office.secretary_agent_id)}
            onEdit={() => {
              setEditingOffice(office);
              setIsModalOpen(true);
            }}
            onDelete={() => onDeleteOffice(office.id)}
          />
        ))}
      </div>
      
      {isModalOpen && (
        <OfficeFormModal
          office={editingOffice}
          secretaries={secretaries.filter(s => s.department_id === null)}
          onSave={async (data) => {
            if (editingOffice) {
              await onUpdateOffice(editingOffice.id, data);
            } else {
              await onCreateOffice(data);
            }
            setIsModalOpen(false);
            setEditingOffice(null);
          }}
          onClose={() => {
            setIsModalOpen(false);
            setEditingOffice(null);
          }}
        />
      )}
    </div>
  );
};
```

#### AnnouncementFeed.tsx

```tsx
interface AnnouncementFeedProps {
  announcements: Announcement[];
  onMarkAsRead: (id: string) => Promise<void>;
}

export const AnnouncementFeed: React.FC<AnnouncementFeedProps> = ({
  announcements,
  onMarkAsRead,
}) => {
  const feedRef = useRef<HTMLDivElement>(null);
  
  // 自动滚动到底部
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [announcements]);
  
  return (
    <div className="announcement-feed" ref={feedRef}>
      <div className="feed-header">
        <h3>📢 全员公告</h3>
        <span className="unread-count">
          {announcements.filter(a => !a.is_read).length} 未读
        </span>
      </div>
      
      <div className="feed-content">
        {announcements.map(announcement => (
          <AnnouncementCard
            key={announcement.id}
            announcement={announcement}
            onMarkAsRead={() => onMarkAsRead(announcement.id)}
          />
        ))}
      </div>
    </div>
  );
};
```

---

## 实施路线图

### Phase 1: 核心基础 (2 周)

#### Week 1: 组织架构 + 记忆管理

**Day 1-2: 数据库迁移**
```bash
# 创建迁移脚本
server/modules/bootstrap/schema/org-schema-migrations.ts
```

**Day 3-5: 记忆管理系统**
- [ ] 实现 `MemoryManager.tsx` 组件
- [ ] 实现后端 API `/api/memories/*`
- [ ] 实现定时记忆提炼服务
- [ ] 添加版本控制和回滚功能

**Day 6-7: 办公室管理**
- [ ] 实现 `OfficeManager.tsx` 组件
- [ ] 实现后端 API `/api/offices/*`
- [ ] 集成到现有组织树

#### Week 2: 任务分发系统

**Day 1-3: 智能分配算法**
- [ ] 实现 `task-dispatcher.ts` 核心算法
- [ ] 编写单元测试
- [ ] 性能优化

**Day 4-5: 任务分发看板**
- [ ] 实现 `TaskDispatchBoard.tsx`
- [ ] 实现后端 API `/api/tasks/dispatch/*`
- [ ] WebSocket 实时更新

**Day 6-7: 集成测试**
- [ ] 端到端测试
- [ ] Bug 修复
- [ ] 文档完善

---

### Phase 2: 功能增强 (3 周)

#### Week 3: 工作流编辑器

**Day 1-2: ReactFlow 集成**
```bash
pnpm add @reactflow/core
```

**Day 3-5: 节点类型实现**
- [ ] StartNode, EndNode
- [ ] AgentNode
- [ ] ConditionNode
- [ ] ToolNode

**Day 6-7: 工作流执行引擎**
- [ ] 实现工作流解释器
- [ ] 状态机管理
- [ ] 执行历史追踪

#### Week 4: 工具库管理

**Day 1-2: 工具库后端**
- [ ] 实现 `/api/tools/*` API
- [ ] 数据库 CRUD

**Day 3-4: 工具库前端**
- [ ] 实现 `ToolLibrary.tsx`
- [ ] 工具分类和搜索

**Day 5-7: 代理工具绑定**
- [ ] 实现 `/api/agents/:agentId/tools/*`
- [ ] 在 AgentFormModal 中集成
- [ ] 工具使用统计

#### Week 5: 员工状态可视化

**Day 1-2: 办公室视图增强**
- [ ] 多层楼场景构建
- [ ] 明亮/暗黑主题切换

**Day 3-4: 工作状态展示**
- [ ] 气泡状态（明亮模式）
- [ ] 亮灯效果（暗黑模式）
- [ ] 实时状态同步

**Day 5-7: 驾驶舱仪表盘**
- [ ] KPI 指标面板
- [ ] 任务进度面板
- [ ] 悬浮展示优化

---

### Phase 3: 体验优化 (1 周)

#### Week 6: 公告系统 + 设置完善

**Day 1-2: 公告实时监控**
- [ ] 实现 `AnnouncementFeed.tsx`
- [ ] WebSocket 实时推送
- [ ] 公告模板系统

**Day 3-4: 设置系统完善**
- [ ] 公司名称、CEO 名称配置
- [ ] 频道配置（企业微信/钉钉）
- [ ] Agent 配置文件在线编辑

**Day 5-7: 测试与优化**
- [ ] 性能优化
- [ ] UI/UX 优化
- [ ] 文档完善
- [ ] 用户测试

---

## 测试策略

### 单元测试

```typescript
// server/modules/core/tasks/task-dispatcher.test.ts
import { describe, it, expect } from 'vitest';
import { calculateAgentScores } from './task-dispatcher';

describe('Task Dispatcher', () => {
  it('should calculate agent scores correctly', () => {
    const criteria = {
      task: { id: 'task-1', department_id: 'dept-1', task_type: 'development' },
      availableAgents: [
        { id: 'agent-1', department_id: 'dept-1', stats_tasks_done: 10, stats_xp: 500 },
        { id: 'agent-2', department_id: 'dept-2', stats_tasks_done: 5, stats_xp: 200 },
      ],
      departments: [],
    };
    
    const scores = calculateAgentScores(criteria);
    
    expect(scores[0].agentId).toBe('agent-1');
    expect(scores[0].factors.departmentMatch).toBe(1.0);
  });
});
```

### 集成测试

```typescript
// tests/e2e/memory-manager.spec.ts
import { test, expect } from '@playwright/test';

test('Memory Manager - CRUD operations', async ({ page }) => {
  await page.goto('http://localhost:8800');
  
  // 导航到记忆管理页面
  await page.click('[data-testid="memory-manager-link"]');
  
  // 选择秘书
  await page.click('[data-testid="secretary-1"]');
  
  // 编辑记忆文件
  await page.fill('[data-testid="memory-content"]', '新的记忆内容');
  await page.click('[data-testid="save-button"]');
  
  // 验证保存成功
  await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
  
  // 测试版本历史
  await page.click('[data-testid="version-history-tab"]');
  await expect(page.locator('[data-testid="version-list"]')).toContainText('版本 2');
});
```

### E2E 测试

```typescript
// tests/e2e/task-dispatch.spec.ts
import { test, expect } from '@playwright/test';

test('Task Dispatch - Auto assignment', async ({ page }) => {
  await page.goto('http://localhost:8800');
  
  // 创建任务
  await page.click('[data-testid="create-task"]');
  await page.fill('[data-testid="task-title"]', '测试任务');
  await page.selectOption('[data-testid="task-department"]', 'dev-dept');
  await page.click('[data-testid="submit-task"]');
  
  // 导航到任务分发看板
  await page.click('[data-testid="dispatch-board-link"]');
  
  // 启用智能分配
  await page.check('[data-testid="auto-assign-toggle"]');
  
  // 执行自动分配
  await page.click('[data-testid="auto-assign-button"]');
  
  // 验证分配结果
  const assignedAgent = await page.locator('[data-testid="assigned-agent"]').textContent();
  expect(assignedAgent).toBeTruthy();
});
```

---

## 性能优化建议

### 1. 数据库优化

```sql
-- 添加索引
CREATE INDEX IF NOT EXISTS idx_memory_files_agent ON memory_files(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dispatch ON tasks(status, department_id, priority);
CREATE INDEX IF NOT EXISTS idx_agent_tools_agent ON agent_tools(agent_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(is_enabled, next_execution_at);
```

### 2. 前端性能

```tsx
// 使用 React.memo 优化组件渲染
export const TaskDispatchCard = React.memo(({ task, onAutoAssign, onManualAssign }) => {
  // 组件逻辑
});

// 使用虚拟滚动处理长列表
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={announcements.length}
  itemSize={100}
  width="100%"
>
  {({ index, style }) => (
    <AnnouncementCard
      key={announcements[index].id}
      announcement={announcements[index]}
      style={style}
    />
  )}
</FixedSizeList>
```

### 3. WebSocket 优化

```typescript
// 实现消息节流
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean;
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  } as T;
}

// 使用节流后的广播函数
const throttledBroadcast = throttle(broadcast, 100);
```

---

## 安全考虑

### 1. 权限控制

```typescript
// 中间件实现
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'insufficient_permissions' });
    }
    next();
  };
}

// 使用示例
app.patch('/api/memories/:agentId/:fileType', requireRole(['secretary', 'ceo']));
```

### 2. 输入验证

```typescript
import { z } from 'zod';

const MemoryUpdateSchema = z.object({
  content: z.string().max(1000000, 'Content too large'),
  version_note: z.string().optional(),
});

app.patch('/api/memories/:agentId/:fileType', (req, res) => {
  const result = MemoryUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'invalid_input', details: result.error });
  }
  // 处理逻辑
});
```

### 3. 敏感数据保护

```typescript
// 记忆内容审计
function auditMemoryContent(content: string): string[] {
  const sensitivePatterns = [
    /password\s*[:=]\s*\S+/gi,
    /api_key\s*[:=]\s*\S+/gi,
    /secret\s*[:=]\s*\S+/gi,
  ];
  
  const violations: string[] = [];
  for (const pattern of sensitivePatterns) {
    if (pattern.test(content)) {
      violations.push('Sensitive data detected');
    }
  }
  
  return violations;
}
```

---

## 监控与日志

### 1. 关键指标监控

```typescript
// 监控指标
interface Metrics {
  memory_file_size: number;      // 记忆文件大小
  task_dispatch_latency: number; // 任务分发延迟
  workflow_execution_time: number; // 工作流执行时间
  agent_utilization: number;     // 代理利用率
}

// 定期上报
setInterval(() => {
  const metrics = collectMetrics();
  reportToMonitoringSystem(metrics);
}, 60000); // 每分钟
```

### 2. 错误追踪

```typescript
// 全局错误处理
process.on('uncaughtException', (error) => {
  console.error('[Fatal] Uncaught Exception:', error);
  logErrorToService(error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fatal] Unhandled Rejection:', reason);
  logErrorToService(reason);
});
```

---

## 部署建议

### Docker 部署

```dockerfile
# Dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 8790 8800

CMD ["pnpm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  claw-empire:
    build: .
    ports:
      - "8790:8790"
      - "8800:8800"
    volumes:
      - ./data:/app/data
      - ./memories:/app/memories
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/claw-empire.sqlite
      - LOGS_DIR=/app/logs
    restart: unless-stopped
```

---

## 总结

本实施文档详细描述了 Claw-Empire 多 Agent 协作系统的完整实施方案，包括：

1. ✅ **组织架构设计** - 4 层层级结构，支持无限扩展
2. ✅ **记忆管理系统** - 秘书专属记忆文件 + 定时提炼
3. ✅ **任务分发系统** - 智能路由算法 + 可视化看板
4. ✅ **工作流系统** - 可视化编辑器 + 状态机管理
5. ✅ **工具库管理** - 统一管理 Skill 和 MCP
6. ✅ **可视化监控** - 像素风办公室 + 实时状态展示

**实施建议**:
- 按照 Phase 1 → Phase 2 → Phase 3 的顺序逐步实施
- 每个阶段完成后进行充分测试
- 收集用户反馈并及时调整

**预期成果**:
- 构建一个功能完整、性能优异的多 Agent 协作系统
- 提供直观易用的可视化管理界面
- 实现智能化的任务分发和执行流程

---

*文档结束*

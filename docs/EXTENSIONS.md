# Claw-Empire 扩展点文档

本文档记录了 Claw-Empire 项目中预留的三个扩展模块，供后续开发接入。

---

## 1. 组织架构可视化树状图 (OrgChart)

**文件位置：** `src/components/OrgChart.tsx`

### 接入说明

OrgChart 组件提供组织架构的树状可视化展示，支持拖拽调整层级关系。

### API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/org-nodes` | 获取所有组织节点 |
| PATCH | `/api/org-nodes/:id` | 更新节点（parent_id） |

### 接入步骤

1. 安装依赖：
   ```bash
   pnpm add reactflow
   ```

2. 调用 API 获取数据：
   ```typescript
   const { data } = await api.get('/api/org-nodes')
   ```

3. 转换为树形结构（使用 `server/modules/routes/core/org-nodes.ts` 中的 `buildOrgTree()`）

4. 渲染 ReactFlow：
   ```typescript
   import { ReactFlow } from 'reactflow'
   import 'reactflow/dist/style.css'
   ```

5. 拖拽调整层级：
   ```typescript
   const onNodeDrag: OnNodeDrag = (_, node) => {
     await api.patch(`/api/org-nodes/${node.id}`, { parent_id: newParentId })
   }
   ```

### 参考资料

- ReactFlow 官方文档：https://reactflow.dev/docs/quickstart
- 现有树形结构实现：`server/modules/routes/core/org-nodes.ts`

---

## 2. 跨部门通信气泡 (CrossDeptChat)

**文件位置：** `src/components/CrossDeptChat.tsx`

### 接入说明

CrossDeptChat 组件实现同级 CEO/部门之间的跨部门通信功能，支持实时消息推送。

### API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/org-nodes/:id/siblings/message` | 发送跨部门消息 |
| GET | `/api/org-nodes/:id/peers` | 获取同级节点列表 |

### 接入步骤

1. 发送跨部门消息：
   ```typescript
   await api.post(`/api/org-nodes/${nodeId}/siblings/message`, {
     message: 'Hello from department A',
     sender_node_id: 'node-xxx'
   })
   ```

2. 监听实时消息（使用 WebSocket）：
   ```typescript
   // 参考 src/hooks/useWebSocket.ts
   const { messages } = useWebSocket('ws://localhost/api/org-nodes/ws')
   ```

3. 在像素办公室显示消息气泡动画

4. 获取同级节点列表：
   ```typescript
   const peers = await api.get(`/api/org-nodes/${nodeId}/peers`)
   ```

### 参考组件

- 消息列表组件：`src/components/chat-panel/ChatMessageList.tsx`
- WebSocket 钩子：`src/hooks/useWebSocket.ts`

---

## 3. 组织层级权限体系 (permissions.ts)

**文件位置：** `server/modules/routes/core/permissions.ts`

### 权限规则

| Tier | 角色 | 权限范围 |
|------|------|----------|
| 0 | SuperCEO | 可查看所有层级的任务、节点、报告 |
| 1 | 秘书/CEO | 只能查看本部门（同 parent_id）的任务和节点 |
| 2 | 组长 | 只能查看本组的任务和员工状态 |
| 3 | 员工 | 只能查看分配给自己的任务 |

### API 接口

| 方法 | 导出函数 | 说明 |
|------|----------|------|
| - | `permissionMiddleware` | 权限验证中间件 |
| - | `checkTierAccess` | 检查是否有所需层级权限 |
| - | `filterByOrgScope` | 根据组织范围过滤数据 |

### 接入步骤

1. 在路由文件中引入：
   ```typescript
   import { permissionMiddleware } from './permissions'
   ```

2. 注册中间件：
   ```typescript
   app.use('/api/tasks', permissionMiddleware())
   ```

3. 在中间件中获取当前用户节点信息：
   ```typescript
   const userNodeId = req.user.org_node_id
   const { tier, parent_id } = await getOrgNode(userNodeId)
   ```

4. 根据权限过滤返回数据：
   ```typescript
   const tasks = await filterByOrgScope(nodeId, tier)
   ```

---

## 数据模型

### OrgNode 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 节点唯一标识 |
| name | string | 节点名称 |
| tier | number | 层级深度（0=SuperCEO, 1=CEO, 2=Agent） |
| parent_id | string \| null | 父节点 ID（null 表示根节点） |
| description | string | 描述 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### 层级关系

```
tier=0 (SuperCEO)
  └── tier=1 (CEO/部门)
        └── tier=2 (组长/Agent)
              └── tier=3 (员工/子Agent)
```

---

## 相关文件列表

| 文件 | 说明 |
|------|------|
| `src/types/org-nodes.ts` | OrgNode 类型定义 |
| `server/db/org-nodes.ts` | 组织节点数据访问层 |
| `server/modules/routes/core/org-nodes.ts` | 组织节点 API 路由 |
| `server/modules/routes/core/permissions.ts` | 权限体系扩展点 |
| `src/components/OrgChart.tsx` | 树状图扩展点 |
| `src/components/CrossDeptChat.tsx` | 跨部门通信扩展点 |
| `src/components/office-view/buildScene-multi-floor.ts` | 多楼层办公室渲染 |

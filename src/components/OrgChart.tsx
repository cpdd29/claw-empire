import React from 'react'

/**
 * TODO: 组织架构可视化树状图扩展点
 * 
 * 接入方式：
 * 1. 安装依赖：pnpm add reactflow
 * 2. 调用 GET /api/org-nodes 获取节点数据
 * 3. 用 org-nodes.ts 里的 buildOrgTree() 转成树形结构
 * 4. 传入 ReactFlow 的 nodes 和 edges 渲染
 * 5. 支持拖拽调整层级：onNodeDrag 回调调用 PATCH /api/org-nodes/:id 更新 parent_id
 * 
 * 参考：https://reactflow.dev/docs/quickstart
 */
export const OrgChart: React.FC = () => null

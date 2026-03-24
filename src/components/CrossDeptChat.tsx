import React from 'react'

/**
 * TODO: 跨部门通信气泡扩展点
 * 
 * 接入方式：
 * 1. 调用 POST /api/org-nodes/:id/siblings/message 发送跨部门消息
 *    body: { message, sender_node_id }
 * 2. 用 WebSocket（src/hooks/useWebSocket.ts）监听实时消息推送
 * 3. 在像素办公室对应楼层显示消息气泡动画
 * 4. 消息历史调用 GET /api/org-nodes/:id/peers 获取同级节点列表
 * 
 * 参考组件：src/components/chat-panel/ChatMessageList.tsx
 */
export const CrossDeptChat: React.FC = () => null

/**
 * Org Nodes API
 */

import type { OrgNode } from "../types/org-nodes";
import { request, post, patch, del } from "./core";

function get<T>(url: string): Promise<T> {
  return request<T>(url);
}

export async function listOrgNodes(): Promise<OrgNode[]> {
  const res = await get<{ ok: boolean; nodes: OrgNode[] }>("/api/org-nodes");
  return res.nodes ?? [];
}

export async function getOrgNode(id: string): Promise<{
  node: OrgNode;
  children: OrgNode[];
  ancestors: OrgNode[];
}> {
  return get<{ ok: boolean; node: OrgNode; children: OrgNode[]; ancestors: OrgNode[] }>(
    `/api/org-nodes/${encodeURIComponent(id)}`
  );
}

export async function createOrgNode(input: {
  name: string;
  name_ko?: string;
  name_ja?: string;
  name_zh?: string;
  tier: number;
  parent_id?: string | null;
  department_id?: string | null;
  agent_id?: string | null;
  metadata_json?: string;
  sort_order?: number;
}): Promise<OrgNode> {
  const res = await post<{ ok: boolean; node: OrgNode }>("/api/org-nodes", input);
  return res.node;
}

export async function updateOrgNode(
  id: string,
  input: Partial<{
    name: string;
    name_ko?: string;
    name_ja?: string;
    name_zh?: string;
    tier: number;
    parent_id: string | null;
    department_id: string | null;
    agent_id: string | null;
    metadata_json: string | null;
    sort_order: number;
  }>
): Promise<OrgNode> {
  const res = await patch<{ ok: boolean; node: OrgNode }>(
    `/api/org-nodes/${encodeURIComponent(id)}`,
    input
  );
  return res.node;
}

export async function deleteOrgNode(id: string): Promise<void> {
  await del<{ ok: boolean }>(`/api/org-nodes/${encodeURIComponent(id)}`);
}

export async function getOrgNodeSubtree(id: string): Promise<OrgNode[]> {
  const res = await get<{ ok: boolean; subtree: OrgNode[] }>(
    `/api/org-nodes/${encodeURIComponent(id)}/subtree`
  );
  return res.subtree ?? [];
}

export async function getOrgNodeAgents(id: string): Promise<unknown[]> {
  const res = await get<{ ok: boolean; agents: unknown[] }>(
    `/api/org-nodes/${encodeURIComponent(id)}/agents`
  );
  return res.agents ?? [];
}

export async function getOrgNodePeers(id: string): Promise<OrgNode[]> {
  const res = await get<{ ok: boolean; peers: OrgNode[] }>(
    `/api/org-nodes/${encodeURIComponent(id)}/peers`
  );
  return res.peers ?? [];
}

export async function sendToSiblings(
  nodeId: string,
  content: string,
  senderAgentId?: string
): Promise<{ sent_count: number; sibling_count: number }> {
  return post<{ ok: boolean; sent_count: number; sibling_count: number }>(
    `/api/org-nodes/${encodeURIComponent(nodeId)}/siblings/message`,
    { content, sender_agent_id: senderAgentId }
  );
}

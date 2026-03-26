import { post, request } from "./core";

export interface MemorySecretary {
  id: string;
  name: string;
  avatar_emoji: string;
  department_id: string;
  has_memory: boolean;
  updated_at?: number | null;
}

export interface MemoryLog {
  id: string;
  content: string;
  type: "add" | "purge";
  created_at: number;
}

export interface AgentMemoryPayload {
  content: string;
  logs: MemoryLog[];
  updated_at: number | null;
}

export interface PurifyAgentMemoryResult extends AgentMemoryPayload {
  before_content: string;
  method: "llm" | "local";
}

export async function listMemorySecretaries(): Promise<MemorySecretary[]> {
  const res = await request<{ ok: boolean; secretaries: MemorySecretary[] }>("/api/memories");
  return res.secretaries ?? [];
}

export async function getAgentMemory(agentId: string): Promise<AgentMemoryPayload> {
  const res = await request<{ ok: boolean; content: string; logs: MemoryLog[]; updated_at: number | null }>(
    `/api/memories/${encodeURIComponent(agentId)}`
  );
  return { content: res.content ?? "", logs: res.logs ?? [], updated_at: res.updated_at ?? null };
}

export async function saveAgentMemory(agentId: string, content: string): Promise<{ updated_at: number | null }> {
  return request<{ ok: boolean; updated_at: number | null }>(`/api/memories/${encodeURIComponent(agentId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function appendAgentMemory(
  agentId: string,
  content: string,
  section?: string
): Promise<{ content: string; updated_at: number | null }> {
  const res = await post<{ ok: boolean; content: string; updated_at: number | null }>(
    `/api/memories/${encodeURIComponent(agentId)}/append`,
    { content, section }
  );
  return { content: res.content ?? "", updated_at: res.updated_at ?? null };
}

export async function purifyAgentMemory(
  agentId: string,
  content?: string
): Promise<PurifyAgentMemoryResult> {
  return post<PurifyAgentMemoryResult>(`/api/memories/${encodeURIComponent(agentId)}/purify`, {
    content,
  });
}

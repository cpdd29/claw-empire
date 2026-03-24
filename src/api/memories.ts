import { request, post } from "./core";

export interface MemorySecretary {
  id: string;
  name: string;
  avatar_emoji: string;
  department_id: string;
  has_memory: boolean;
}

export interface MemoryLog {
  id: string;
  content: string;
  type: "add" | "purge";
  created_at: number;
}

export async function listMemorySecretaries(): Promise<MemorySecretary[]> {
  const res = await request<{ ok: boolean; secretaries: MemorySecretary[] }>("/api/memories");
  return res.secretaries ?? [];
}

export async function getAgentMemory(agentId: string): Promise<{ content: string; logs: MemoryLog[] }> {
  const res = await request<{ ok: boolean; content: string; logs: MemoryLog[] }>(
    `/api/memories/${encodeURIComponent(agentId)}`
  );
  return { content: res.content ?? "", logs: res.logs ?? [] };
}

export async function saveAgentMemory(agentId: string, content: string): Promise<void> {
  await fetch(`/api/memories/${encodeURIComponent(agentId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function appendAgentMemory(
  agentId: string,
  content: string,
  section?: string
): Promise<{ content: string }> {
  const res = await post<{ ok: boolean; content: string }>(
    `/api/memories/${encodeURIComponent(agentId)}/append`,
    { content, section }
  );
  return { content: res.content ?? "" };
}

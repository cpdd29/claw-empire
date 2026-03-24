import { request, post } from "./core";

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  nodes_json: string | null;
  edges_json: string | null;
  status: "draft" | "active" | "archived";
  assigned_agent_id: string | null;
  run_count: number;
  created_at: number;
  updated_at: number;
}

export async function listWorkflows(): Promise<Workflow[]> {
  const res = await request<{ ok: boolean; workflows: Workflow[] }>("/api/workflows");
  return res.workflows ?? [];
}

export async function getWorkflow(id: string): Promise<Workflow> {
  const res = await request<{ ok: boolean; workflow: Workflow }>(`/api/workflows/${encodeURIComponent(id)}`);
  return res.workflow;
}

export async function createWorkflow(input: {
  name: string;
  description?: string;
  assigned_agent_id?: string | null;
  nodes_json?: string;
  edges_json?: string;
}): Promise<Workflow> {
  const res = await post<{ ok: boolean; workflow: Workflow }>("/api/workflows", input);
  return res.workflow;
}

export async function updateWorkflow(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    nodes_json: string;
    edges_json: string;
    status: string;
    assigned_agent_id: string | null;
  }>,
): Promise<Workflow> {
  const res = await fetch(`/api/workflows/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json() as { ok: boolean; workflow: Workflow };
  return data.workflow;
}

export async function deleteWorkflow(id: string): Promise<void> {
  await fetch(`/api/workflows/${encodeURIComponent(id)}`, { method: "DELETE" });
}

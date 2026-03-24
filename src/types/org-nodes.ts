/**
 * Org Nodes Type Definitions
 * 
 * Frontend types for the hierarchical CEO structure
 * 
 * Tier Hierarchy:
 * - Tier 0: SuperCEO (唯一根节点，下达战略任务)
 * - Tier 1: Secretary (每部门1个，拆解任务+分配给组长+管理记忆+跨部门协调)
 * - Tier 2: Leader (制定工作流，监督员工，协调组内协作)
 * - Tier 3: Agent (实际执行者，调用工具完成任务)
 */

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
  agent_id: string | null;  // Direct agent assignment
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
    label: { en: "SuperCEO", ko: "슈퍼 CEO", ja: "最高CEO", zh: "超级CEO" },
    icon: "👑",
    color: { light: "#D97706", dark: "#F59E0B" }, // 金色
  },
  1: {
    label: { en: "Secretary", ko: "비서", ja: " секретар", zh: "秘书" },
    icon: "📋",
    color: { light: "#7C3AED", dark: "#8B5CF6" }, // 紫色
  },
  2: {
    label: { en: "Leader", ko: "리더", ja: "リーダー", zh: "组长" },
    icon: "👥",
    color: { light: "#0891B2", dark: "#06B6D4" }, // 青色
  },
  3: {
    label: { en: "Agent", ko: "에이전트", ja: "エージェント", zh: "员工" },
    icon: "⚡",
    color: { light: "#F97316", dark: "#FB923C" }, // 珊瑚色
  },
};

export const TIER_LABELS: Record<OrgNodeTier, { en: string; ko: string; ja: string; zh: string }> = {
  0: { en: "SuperCEO", ko: "슈퍼 CEO", ja: "最高CEO", zh: "超级CEO" },
  1: { en: "Secretary", ko: "비서", ja: " секретар", zh: "秘书" },
  2: { en: "Leader", ko: "리더", ja: "リーダー", zh: "组长" },
  3: { en: "Agent", ko: "에이전트", ja: "エージェント", zh: "员工" },
};

export interface OrgNodeTree extends OrgNode {
  children: OrgNodeTree[];
  ancestor_path?: OrgNode[];
}

export interface OrgNodeWithRelations extends OrgNode {
  children: OrgNode[];
  ancestors: OrgNode[];
}

export interface CreateOrgNodeRequest {
  name: string;
  name_ko?: string;
  name_ja?: string;
  name_zh?: string;
  tier: OrgNodeTier;
  parent_id?: string | null;
  department_id?: string | null;
  metadata_json?: string;
  sort_order?: number;
}

export interface UpdateOrgNodeRequest {
  name?: string;
  name_ko?: string;
  name_ja?: string;
  name_zh?: string;
  tier?: OrgNodeTier;
  parent_id?: string | null;
  department_id?: string | null;
  metadata_json?: string;
  sort_order?: number;
}

export interface OrgNodeApiResponse {
  ok: boolean;
  nodes?: OrgNode[];
  node?: OrgNode;
  children?: OrgNode[];
  ancestors?: OrgNode[];
  subtree?: OrgNode[];
  peers?: OrgNode[];
  error?: string;
}

export interface CreateOrgNodeResponse {
  ok: boolean;
  node?: OrgNode;
  error?: string;
}

export interface DeleteOrgNodeResponse {
  ok: boolean;
  error?: string;
  child_count?: number;
}

export interface CrossNodeMessageRequest {
  content: string;
  sender_agent_id?: string;
}

export interface CrossNodeMessageResponse {
  ok: boolean;
  sent_count: number;
  sibling_count: number;
  message?: string;
  error?: string;
}

/**
 * Get tier configuration
 */
export function getTierConfig(tier: OrgNodeTier) {
  return TIER_CONFIG[tier];
}

/**
 * Convert flat org nodes list to tree structure
 */
export function buildOrgNodeTree(nodes: OrgNode[]): OrgNodeTree[] {
  const nodeMap = new Map<string, OrgNodeTree>();
  const roots: OrgNodeTree[] = [];

  // Create tree nodes
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] });
  }

  // Build tree
  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  return roots;
}

/**
 * Get depth of a node in the tree
 */
export function getNodeDepth(nodes: OrgNode[], nodeId: string): number {
  let depth = 0;
  let current = nodes.find((n) => n.id === nodeId);

  while (current?.parent_id) {
    depth++;
    current = nodes.find((n) => n.id === current!.parent_id);
  }

  return depth;
}

/**
 * Get all ancestor IDs for a node
 */
export function getAncestorIds(nodes: OrgNode[], nodeId: string): string[] {
  const ancestors: string[] = [];
  let current = nodes.find((n) => n.id === nodeId);

  while (current?.parent_id) {
    ancestors.push(current.parent_id);
    current = nodes.find((n) => n.id === current!.parent_id);
  }

  return ancestors;
}

/**
 * Get all descendant IDs for a node
 */
export function getDescendantIds(nodes: OrgNode[], nodeId: string): string[] {
  const descendants: string[] = [];
  const stack = [nodeId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const children = nodes.filter((n) => n.parent_id === currentId);

    for (const child of children) {
      descendants.push(child.id);
      stack.push(child.id);
    }
  }

  return descendants;
}

/**
 * Check if nodeA is an ancestor of nodeB
 */
export function isAncestorOf(nodes: OrgNode[], ancestorId: string, descendantId: string): boolean {
  return getAncestorIds(nodes, descendantId).includes(ancestorId);
}

/**
 * Check if two nodes are siblings (same parent)
 */
export function areSiblings(nodes: OrgNode[], nodeId1: string, nodeId2: string): boolean {
  const node1 = nodes.find((n) => n.id === nodeId1);
  const node2 = nodes.find((n) => n.id === nodeId2);
  return node1?.parent_id === node2?.parent_id && node1?.parent_id !== null;
}

/**
 * Get all peer nodes (same tier, same parent)
 */
export function getPeers(nodes: OrgNode[], nodeId: string): OrgNode[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return [];

  return nodes.filter(
    (n) => n.tier === node.tier && n.parent_id === node.parent_id && n.id !== nodeId,
  );
}

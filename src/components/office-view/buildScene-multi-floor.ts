/**
 * Multi-Floor Office Scene Builder
 * 
 * Renders org nodes by tier as 4 floors:
 * - Floor 0 (top): SuperCEO luxury office
 * - Floor 1: Secretary floor (small offices per department)
 * - Floor 2: Team lead floor (cubicles)
 * - Floor 3 (bottom): Employee floor (desks in rows)
 */

import type { MutableRefObject } from "react";
import { Container, Graphics, Text, TextStyle, type Application } from "pixi.js";
import type { Agent, Task } from "../../types";
import type { OrgNode } from "../../types/org-nodes";
import type { Delivery, RoomTheme, WallClockVisual } from "./model";
import { TILE, emitSubCloneSmokeBurst } from "./model";
import { LOCALE_TEXT, type SupportedLocale, pickLocale } from "./themes-locale";
import { blendColor, drawAmbientGlow, drawBandGradient, drawTiledFloor, drawWallClock } from "./drawing-core";
import { drawChair, drawPlant, drawDesk } from "./drawing-furniture-a";

interface MultiFloorParams {
  app: Application;
  OFFICE_W: number;
  orgNodes: OrgNode[];
  agents: Agent[];
  tasks: Task[];
  activeLocale: SupportedLocale;
  isDark: boolean;
  onSelectAgent: (agent: Agent) => void;
  onSelectNode: (node: OrgNode) => void;
  deliveriesRef: MutableRefObject<Delivery[]>;
  wallClocksRef: MutableRefObject<WallClockVisual[]>;
  totalHRef: MutableRefObject<number>;
}

// Floor configuration
const FLOOR_CONFIG = {
  0: { // SuperCEO
    name: { en: "SuperCEO Office", ko: "슈퍼CEO 오피스", ja: "最高CEOオフィス", zh: "超级CEO办公室" },
    height: 120,
    theme: { floor1: 0x4a3828, floor2: 0x5a4838, wall: 0x8b6914, accent: 0xffd700 },
    roomStyle: "luxury" as const,
  },
  1: { // Secretary
    name: { en: "Secretary Floor", ko: "비서 층", ja: "秘書フロア", zh: "秘书层" },
    height: 100,
    theme: { floor1: 0x3a3030, floor2: 0x4a4040, wall: 0x5a4a5a, accent: 0xcc99ff },
    roomStyle: "small_office" as const,
  },
  2: { // Team Lead
    name: { en: "Team Lead Floor", ko: "팀장 층", ja: "チームリーダーフロア", zh: "组长层" },
    height: 90,
    theme: { floor1: 0x304030, floor2: 0x405040, wall: 0x4a6050, accent: 0x66cc88 },
    roomStyle: "cubicle" as const,
  },
  3: { // Employee
    name: { en: "Employee Floor", ko: "사원 층", ja: "社員フロア", zh: "员工层" },
    height: 80,
    theme: { floor1: 0x303040, floor2: 0x404050, wall: 0x4a4a6a, accent: 0x6688cc },
    roomStyle: "desks" as const,
  },
} as const;

const HALLWAY_H = 28;
const STAIRS_W = 40;
const FLOOR_LABEL_H = 18;

export function buildMultiFloorOffice(params: MultiFloorParams): void {
  const {
    app,
    OFFICE_W,
    orgNodes,
    agents,
    tasks,
    activeLocale,
    isDark,
    onSelectAgent,
    onSelectNode,
    deliveriesRef,
    wallClocksRef,
    totalHRef,
  } = params;

  // Group nodes by tier
  const nodesByTier: Record<number, OrgNode[]> = {};
  for (const node of orgNodes) {
    if (!nodesByTier[node.tier]) nodesByTier[node.tier] = [];
    nodesByTier[node.tier].push(node);
  }

  // Calculate total height
  let totalH = 20; // top padding
  for (let tier = 0; tier <= 3; tier++) {
    totalH += FLOOR_CONFIG[tier as keyof typeof FLOOR_CONFIG].height;
    if (tier < 3) totalH += HALLWAY_H; // hallways between floors
  }
  totalH += 20; // bottom padding

  totalHRef.current = totalH;
  app.renderer.resize(OFFICE_W, totalH);

  // Background
  const bg = new Graphics();
  const bgFill = isDark ? 0x0e0e1c : 0xf5f0e8;
  bg.roundRect(0, 0, OFFICE_W, totalH, 6).fill(bgFill);
  bg.roundRect(2, 2, OFFICE_W - 4, totalH - 4, 5).stroke({ width: 1.5, color: isDark ? 0x2a2a48 : 0xd8cfc0 });
  app.stage.addChild(bg);

  // Track Y positions
  let currentY = 20;

  // Build each floor
  for (let tier = 0; tier <= 3; tier++) {
    const config = FLOOR_CONFIG[tier as keyof typeof FLOOR_CONFIG];
    const floorNodes = nodesByTier[tier] || [];
    const floorAgents = getAgentsForTier(orgNodes, tier, agents);

    buildFloor({
      app,
      OFFICE_W,
      tier,
      nodes: floorNodes,
      agents: floorAgents,
      tasks,
      theme: config.theme,
      roomStyle: config.roomStyle,
      floorName: config.name,
      y: currentY,
      height: config.height,
      isDark,
      activeLocale,
      onSelectAgent,
      onSelectNode,
      wallClocksRef,
    });

    currentY += config.height;

    // Add hallway with stairs between floors (except after last floor)
    if (tier < 3) {
      buildHallwayWithStairs({
        app,
        OFFICE_W,
        y: currentY,
        height: HALLWAY_H,
        isDark,
        fromTier: tier,
        toTier: tier + 1,
      });
      currentY += HALLWAY_H;
    }
  }

  // Draw stairs on the side
  drawStairs(app.stage, OFFICE_W, 20, totalH - 20, isDark);
}

interface FloorParams {
  app: Application;
  OFFICE_W: number;
  tier: number;
  nodes: OrgNode[];
  agents: Agent[];
  tasks: Task[];
  theme: RoomTheme;
  roomStyle: "luxury" | "small_office" | "cubicle" | "desks";
  floorName: { en: string; ko: string; ja: string; zh: string };
  y: number;
  height: number;
  isDark: boolean;
  activeLocale: SupportedLocale;
  onSelectAgent: (agent: Agent) => void;
  onSelectNode: (node: OrgNode) => void;
  wallClocksRef: MutableRefObject<WallClockVisual[]>;
}

function buildFloor(params: FloorParams): void {
  const {
    app,
    OFFICE_W,
    tier,
    nodes,
    agents,
    tasks,
    theme,
    roomStyle,
    floorName,
    y,
    height,
    isDark,
    activeLocale,
    onSelectAgent,
    onSelectNode,
    wallClocksRef,
  } = params;

  const floorLayer = new Container();
  floorLayer.position.y = y;

  // Floor background
  const floorBg = new Graphics();
  drawTiledFloor(floorBg, 4, FLOOR_LABEL_H, OFFICE_W - 8, height - FLOOR_LABEL_H - 4, theme.floor1, theme.floor2);
  floorLayer.addChild(floorBg);

  // Top accent bar
  const accentBar = new Graphics();
  accentBar.rect(4, 0, OFFICE_W - 8, FLOOR_LABEL_H).fill(theme.accent);
  floorLayer.addChild(accentBar);

  // Floor label
  const floorLabel = new Text({
    text: `${getTierEmoji(tier)} ${pickLocale(activeLocale, floorName)}`,
    style: new TextStyle({
      fontSize: 10,
      fill: isDark ? 0x000000 : 0xffffff,
      fontWeight: "bold",
      fontFamily: "system-ui, sans-serif",
    }),
  });
  floorLabel.position.set(8, 3);
  floorLayer.addChild(floorLabel);

  // Node count badge
  const nodeCount = new Text({
    text: `${nodes.length} nodes`,
    style: new TextStyle({
      fontSize: 8,
      fill: isDark ? 0x333333 : 0xffffff,
      fontFamily: "system-ui, sans-serif",
    }),
  });
  nodeCount.position.set(OFFICE_W - 70, 4);
  floorLayer.addChild(nodeCount);

  // Draw rooms based on style
  const contentY = FLOOR_LABEL_H + 8;
  const contentH = height - FLOOR_LABEL_H - 12;

  switch (roomStyle) {
    case "luxury":
      buildLuxuryFloor(floorLayer, OFFICE_W, tier, nodes, agents, tasks, theme, contentY, contentH, activeLocale, onSelectNode, onSelectAgent);
      break;
    case "small_office":
      buildSecretaryFloor(floorLayer, OFFICE_W, tier, nodes, agents, tasks, theme, contentY, contentH, activeLocale, onSelectNode, onSelectAgent);
      break;
    case "cubicle":
      buildTeamLeadFloor(floorLayer, OFFICE_W, tier, nodes, agents, tasks, theme, contentY, contentH, activeLocale, onSelectNode, onSelectAgent);
      break;
    case "desks":
      buildEmployeeFloor(floorLayer, OFFICE_W, tier, nodes, agents, tasks, theme, contentY, contentH, activeLocale, onSelectNode, onSelectAgent);
      break;
  }

  // Ambient glow
  drawAmbientGlow(floorLayer, OFFICE_W / 2, contentY + contentH / 2, OFFICE_W * 0.35, theme.accent, 0.06);

  // Wall clock
  wallClocksRef.current.push(drawWallClock(floorLayer, OFFICE_W - 20, 6));

  // Decorative plants
  drawPlant(floorLayer as unknown as Container, 16, contentY + contentH - 10, tier);
  drawPlant(floorLayer as unknown as Container, OFFICE_W - 20, contentY + contentH - 10, tier + 2);

  app.stage.addChild(floorLayer);
}

function buildLuxuryFloor(
  parent: Container,
  OFFICE_W: number,
  tier: number,
  nodes: OrgNode[],
  agents: Agent[],
  tasks: Task[],
  theme: RoomTheme,
  y: number,
  h: number,
  activeLocale: SupportedLocale,
  onSelectNode: (node: OrgNode) => void,
  onSelectAgent: (agent: Agent) => void,
): void {
  // SuperCEO gets a large central office
  const roomW = OFFICE_W - 40;
  const roomH = h - 16;
  const roomX = 20;
  const roomY = y + 8;

  // Office border
  const border = new Graphics();
  border.roundRect(roomX, roomY, roomW, roomH, 8)
    .stroke({ width: 3, color: theme.accent });
  parent.addChild(border);

  // Grand desk
  const deskX = roomX + roomW / 2;
  const deskY = roomY + 30;
  const grandDesk = new Graphics();
  grandDesk.roundRect(deskX - 50, deskY, 100, 40, 4).fill(0x8b6914);
  grandDesk.roundRect(deskX - 48, deskY + 2, 96, 36, 3).fill(0xd4a860);
  parent.addChild(grandDesk);

  // Big chair
  drawChair(parent, deskX, deskY + 50, 0xffd700);

  // Meeting table
  const mtX = roomX + roomW / 2;
  const mtY = roomY + roomH - 30;
  const mt = new Graphics();
  mt.roundRect(mtX - 80, mtY - 15, 160, 30, 12).fill(0x5a4030);
  mt.roundRect(mtX - 78, mtY - 13, 156, 26, 10).fill(0x8b6914);
  parent.addChild(mt);

  // Node info panel
  if (nodes.length > 0) {
    const node = nodes[0]; // SuperCEO is usually single
    const infoPanel = new Graphics();
    infoPanel.roundRect(roomX + 20, roomY + 10, 120, 40, 4)
      .fill({ color: theme.accent, alpha: 0.3 })
      .stroke({ width: 1, color: theme.accent });
    parent.addChild(infoPanel);

    const infoText = new Text({
      text: `👑 ${node.name}`,
      style: new TextStyle({
        fontSize: 10,
        fill: 0xffffff,
        fontWeight: "bold",
        fontFamily: "system-ui, sans-serif",
      }),
    });
    infoText.position.set(roomX + 28, roomY + 16);
    parent.addChild(infoText);

    // Task count
    const taskCount = tasks.filter(t => (t as any).current_org_node_id === node.id && t.status !== "done").length;
    const taskBadge = new Text({
      text: `📋 ${taskCount}`,
      style: new TextStyle({ fontSize: 8, fill: 0xffd700, fontFamily: "monospace" }),
    });
    taskBadge.position.set(roomX + 28, roomY + 30);
    parent.addChild(taskBadge);
  }

  // Click to select
  parent.eventMode = "static";
  parent.cursor = "pointer";
  parent.on("pointerdown", () => {
    if (nodes.length > 0) onSelectNode(nodes[0]);
  });
}

function buildSecretaryFloor(
  parent: Container,
  OFFICE_W: number,
  tier: number,
  nodes: OrgNode[],
  agents: Agent[],
  tasks: Task[],
  theme: RoomTheme,
  y: number,
  h: number,
  activeLocale: SupportedLocale,
  onSelectNode: (node: OrgNode) => void,
  onSelectAgent: (agent: Agent) => void,
): void {
  // Secretary gets small offices
  const officeW = 100;
  const officeH = h - 20;
  const gap = 12;
  const startX = 20;
  const maxPerRow = Math.floor((OFFICE_W - 40) / (officeW + gap));
  const count = Math.min(nodes.length, maxPerRow * 2);

  nodes.slice(0, count).forEach((node, idx) => {
    const col = idx % maxPerRow;
    const row = Math.floor(idx / maxPerRow);
    const ox = startX + col * (officeW + gap);
    const oy = y + 10 + row * (officeH + 8);

    // Small office room
    const room = new Graphics();
    room.roundRect(ox, oy, officeW, officeH, 4)
      .fill({ color: theme.wall, alpha: 0.2 })
      .stroke({ width: 2, color: theme.accent });
    parent.addChild(room);

    // Small desk
    drawDesk(parent, ox + officeW / 2 - 20, oy + officeH - 30, false);

    // Secretary name
    const nameText = new Text({
      text: `📋 ${node.name}`,
      style: new TextStyle({
        fontSize: 9,
        fill: 0xffffff,
        fontWeight: "bold",
        fontFamily: "system-ui, sans-serif",
      }),
    });
    nameText.position.set(ox + 8, oy + 8);
    parent.addChild(nameText);

    // Active task bubble
    const nodeTasks = tasks.filter(t => (t as any).current_org_node_id === node.id && t.status !== "done").length;
    if (nodeTasks > 0) {
      const bubble = new Graphics();
      bubble.circle(ox + officeW - 15, oy + 15, 12)
        .fill(0xff6644)
        .stroke({ width: 1, color: 0xffffff });
      parent.addChild(bubble);
      const bubbleText = new Text({
        text: String(nodeTasks),
        style: new TextStyle({ fontSize: 8, fill: 0xffffff, fontWeight: "bold" }),
      });
      bubbleText.anchor.set(0.5, 0.5);
      bubbleText.position.set(ox + officeW - 15, oy + 15);
      parent.addChild(bubbleText);
    }

    // Click handler
    room.eventMode = "static";
    room.cursor = "pointer";
    room.on("pointerdown", () => onSelectNode(node));
  });
}

function buildTeamLeadFloor(
  parent: Container,
  OFFICE_W: number,
  tier: number,
  nodes: OrgNode[],
  agents: Agent[],
  tasks: Task[],
  theme: RoomTheme,
  y: number,
  h: number,
  activeLocale: SupportedLocale,
  onSelectNode: (node: OrgNode) => void,
  onSelectAgent: (agent: Agent) => void,
): void {
  // Team leads get cubicles
  const cubicleW = 80;
  const cubicleH = h - 16;
  const gap = 8;
  const startX = 16;
  const maxPerRow = Math.floor((OFFICE_W - 32) / (cubicleW + gap));
  const count = Math.min(nodes.length, maxPerRow * 3);

  nodes.slice(0, count).forEach((node, idx) => {
    const col = idx % maxPerRow;
    const row = Math.floor(idx / maxPerRow);
    const cx = startX + col * (cubicleW + gap);
    const cy = y + 8 + row * (cubicleH + 6);

    // Cubicle walls (3 sides)
    const cubicle = new Graphics();
    // Back wall
    cubicle.rect(cx, cy, cubicleW, 4).fill(theme.wall);
    // Left wall
    cubicle.rect(cx, cy, 4, cubicleH).fill(theme.wall);
    // Right wall
    cubicle.rect(cx + cubicleW - 4, cy, 4, cubicleH).fill(theme.wall);
    parent.addChild(cubicle);

    // Small desk
    drawDesk(parent, cx + cubicleW / 2 - 15, cy + cubicleH - 25, false);

    // Lead name
    const nameText = new Text({
      text: `👔 ${node.name}`,
      style: new TextStyle({
        fontSize: 8,
        fill: 0xffffff,
        fontFamily: "system-ui, sans-serif",
      }),
    });
    nameText.position.set(cx + 8, cy + 8);
    parent.addChild(nameText);

    // Subordinate count badge
    const subordinates = getSubordinateCount(orgNodes, node.id);
    if (subordinates > 0) {
      const badge = new Graphics();
      badge.roundRect(cx + cubicleW - 30, cy + 6, 24, 12, 3)
        .fill({ color: theme.accent, alpha: 0.8 });
      parent.addChild(badge);
      const badgeText = new Text({
        text: `👥${subordinates}`,
        style: new TextStyle({ fontSize: 7, fill: 0xffffff }),
      });
      badgeText.position.set(cx + cubicleW - 28, cy + 8);
      parent.addChild(badgeText);
    }

    // Click handler
    cubicle.eventMode = "static";
    cubicle.cursor = "pointer";
    cubicle.on("pointerdown", () => onSelectNode(node));
  });
}

function buildEmployeeFloor(
  parent: Container,
  OFFICE_W: number,
  tier: number,
  nodes: OrgNode[],
  agents: Agent[],
  tasks: Task[],
  theme: RoomTheme,
  y: number,
  h: number,
  activeLocale: SupportedLocale,
  onSelectNode: (node: OrgNode) => void,
  onSelectAgent: (agent: Agent) => void,
): void {
  // Employees get rows of desks
  const deskW = 50;
  const deskGap = 6;
  const rowH = 35;
  const startX = 20;
  const maxPerRow = Math.floor((OFFICE_W - 40) / (deskW + deskGap));
  const count = Math.min(agents.length, maxPerRow * 4);

  agents.slice(0, count).forEach((agent, idx) => {
    const col = idx % maxPerRow;
    const row = Math.floor(idx / maxPerRow);
    const dx = startX + col * (deskW + deskGap);
    const dy = y + 8 + row * (rowH + 4);

    // Desk
    drawDesk(parent, dx, dy, false);

    // Agent indicator
    const isWorking = agent.status === "working";
    const indicator = new Graphics();
    indicator.circle(dx + deskW / 2, dy - 5, 4)
      .fill(isWorking ? 0x44ff44 : 0x888888);
    parent.addChild(indicator);

    // Agent name (truncated)
    const nameText = new Text({
      text: agent.name.slice(0, 6),
      style: new TextStyle({
        fontSize: 6,
        fill: 0xcccccc,
        fontFamily: "monospace",
      }),
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(dx + deskW / 2, dy + deskW + 2);
    parent.addChild(nameText);

    // Click handler
    indicator.eventMode = "static";
    indicator.cursor = "pointer";
    indicator.on("pointerdown", () => onSelectAgent(agent));
  });
}

interface HallwayParams {
  app: Application;
  OFFICE_W: number;
  y: number;
  height: number;
  isDark: boolean;
  fromTier: number;
  toTier: number;
}

function buildHallwayWithStairs(params: HallwayParams): void {
  const { app, OFFICE_W, y, height, isDark, fromTier, toTier } = params;

  const hallG = new Graphics();
  const hallBase = isDark ? 0x252535 : 0xe8dcc8;
  const hallTile1 = isDark ? 0x2d2d40 : 0xf0e4d0;
  const hallTile2 = isDark ? 0x1f1f30 : 0xe8dcc8;

  hallG.rect(4, y, OFFICE_W - 8, height).fill(hallBase);
  drawBandGradient(hallG, 4, y, OFFICE_W - 8, height, hallTile1, hallTile2, 4, 0.3);

  // Stairs indicator (arrow down)
  const stairX = OFFICE_W - 50;
  const stairY = y + height / 2;
  const stairText = new Text({
    text: `⬇ ${getTierEmoji(toTier)}`,
    style: new TextStyle({
      fontSize: 14,
      fill: isDark ? 0xaaaaaa : 0x666666,
      fontFamily: "system-ui, sans-serif",
    }),
  });
  stairText.position.set(stairX, stairY - 8);
  hallG.addChild(stairText);

  // Floor transition label
  const labelText = new Text({
    text: `${getTierEmoji(fromTier)} → ${getTierEmoji(toTier)}`,
    style: new TextStyle({
      fontSize: 8,
      fill: isDark ? 0x888888 : 0x999999,
      fontFamily: "monospace",
    }),
  });
  labelText.position.set(stairX - 60, stairY - 4);
  hallG.addChild(labelText);

  app.stage.addChild(hallG);
}

function drawStairs(parent: Container, OFFICE_W: number, startY: number, endY: number, isDark: boolean): void {
  const stairsG = new Graphics();
  const stairCount = 4;
  const stairH = (endY - startY) / stairCount;
  const stairW = 30;
  const stairX = 8;

  for (let i = 0; i < stairCount; i++) {
    const sy = startY + i * stairH;
    stairsG.rect(stairX, sy, stairW, stairH - 2)
      .fill({ color: isDark ? 0x3a3a50 : 0xc8b898, alpha: 0.6 })
      .stroke({ width: 1, color: isDark ? 0x4a4a60 : 0xa89878 });
  }

  parent.addChild(stairsG);
}

// Helper functions
function getTierEmoji(tier: number): string {
  const emojis = ["👑", "📋", "👔", "💼"];
  return emojis[tier] || "🏢";
}

function getAgentsForTier(orgNodes: OrgNode[], tier: number, allAgents: Agent[]): Agent[] {
  // Get agents linked to nodes of this tier
  const nodeIds = new Set(orgNodes.filter(n => n.tier === tier).map(n => n.id));
  return allAgents.filter(agent => {
    const agentNodeId = (agent as any).org_node_id;
    if (agentNodeId && nodeIds.has(agentNodeId)) return true;
    // Fallback: use tier field if available
    return (agent as any).tier === tier;
  });
}

function getSubordinateCount(orgNodes: OrgNode[], nodeId: string): number {
  return orgNodes.filter(n => n.parent_id === nodeId).length;
}

// Keep orgNodes accessible in nested functions
let orgNodes: OrgNode[] = [];
export function setOrgNodesForFloor(nodes: OrgNode[]): void {
  orgNodes = nodes;
}

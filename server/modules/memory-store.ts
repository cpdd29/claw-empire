import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORIES_DIR = resolve(__dirname, "../../memories");

export const MEMORY_SECTIONS = [
  "## 用户信息",
  "## 重要决策记录",
  "## 对话摘要",
  "## 关键偏好",
] as const;

export type MemorySection = (typeof MEMORY_SECTIONS)[number];

export function createDefaultMemoryContent(): string {
  return `${MEMORY_SECTIONS[0]}\n\n（暂无）\n\n${MEMORY_SECTIONS[1]}\n\n（暂无）\n\n${MEMORY_SECTIONS[2]}\n\n（暂无）\n\n${MEMORY_SECTIONS[3]}\n\n（暂无）\n`;
}

export function ensureMemoriesDir(): void {
  if (!existsSync(MEMORIES_DIR)) mkdirSync(MEMORIES_DIR, { recursive: true });
}

export function memoryFilePath(agentId: string): string {
  return resolve(MEMORIES_DIR, `${agentId}.md`);
}

export function hasMemoryFile(agentId: string): boolean {
  return existsSync(memoryFilePath(agentId));
}

export function getMemoryUpdatedAt(agentId: string): number | null {
  const filePath = memoryFilePath(agentId);
  if (!existsSync(filePath)) return null;
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, "\n");
}

export function normalizeMemoryContent(content: string): string {
  let normalized = normalizeLineEndings(content || "").trim();
  if (!normalized) return createDefaultMemoryContent();

  for (const section of MEMORY_SECTIONS) {
    if (!normalized.includes(section)) {
      normalized += `\n\n${section}\n\n（暂无）`;
    }
  }

  return `${normalized.trimEnd()}\n`;
}

export function readMemoryFile(agentId: string): string {
  const filePath = memoryFilePath(agentId);
  if (!existsSync(filePath)) return createDefaultMemoryContent();
  return normalizeMemoryContent(readFileSync(filePath, "utf-8"));
}

export function writeMemoryFile(agentId: string, content: string): number | null {
  ensureMemoriesDir();
  writeFileSync(memoryFilePath(agentId), normalizeMemoryContent(content), "utf-8");
  return getMemoryUpdatedAt(agentId);
}

function findSectionRange(content: string, section: MemorySection): { start: number; end: number } | null {
  const start = content.indexOf(section);
  if (start < 0) return null;
  const nextStarts = MEMORY_SECTIONS
    .filter((candidate) => candidate !== section)
    .map((candidate) => content.indexOf(candidate, start + section.length))
    .filter((index) => index > start)
    .sort((a, b) => a - b);
  return { start, end: nextStarts[0] ?? content.length };
}

function formatMemoryBullet(text: string, dateLabel: string): string {
  return `- ${dateLabel}: ${text.trim()}`;
}

function cleanSectionBody(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "（暂无）");
}

export function appendMemorySectionEntries(
  content: string,
  section: MemorySection,
  entries: string[],
  dateInput: number = Date.now(),
): string {
  const uniqueEntries = Array.from(
    new Set(
      entries
        .map((entry) => entry.replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  );
  if (uniqueEntries.length === 0) return normalizeMemoryContent(content);

  const normalized = normalizeMemoryContent(content);
  const range = findSectionRange(normalized, section);
  if (!range) return normalized;

  const sectionBlock = normalized.slice(range.start, range.end);
  const body = sectionBlock.slice(section.length).trim();
  const dateLabel = new Date(dateInput).toISOString().slice(0, 10);
  const existingLines = cleanSectionBody(body);
  const nextLines = [...existingLines];

  for (const entry of uniqueEntries) {
    const formatted = formatMemoryBullet(entry, dateLabel);
    if (!nextLines.includes(formatted)) {
      nextLines.unshift(formatted);
    }
  }

  const nextBlock = `${section}\n\n${nextLines.length > 0 ? nextLines.join("\n") : "（暂无）"}\n`;
  return `${normalized.slice(0, range.start)}${nextBlock}${normalized.slice(range.end).replace(/^\n*/, "\n\n")}`.replace(
    /\n{3,}/g,
    "\n\n",
  );
}

export function appendMemorySections(
  content: string,
  updates: Partial<Record<MemorySection, string[]>>,
  dateInput: number = Date.now(),
): string {
  let next = normalizeMemoryContent(content);
  for (const section of MEMORY_SECTIONS) {
    next = appendMemorySectionEntries(next, section, updates[section] ?? [], dateInput);
  }
  return normalizeMemoryContent(next);
}

export function hasMeaningfulMemoryContent(content: string): boolean {
  return normalizeMemoryContent(content)
    .split("\n")
    .some((line) => {
      const trimmed = line.trim();
      return Boolean(trimmed && !trimmed.startsWith("##") && trimmed !== "（暂无）");
    });
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function stripMarkdownCodeFence(text: string): string {
  const trimmed = String(text || "").trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```[a-zA-Z0-9_-]*\n?/, "").replace(/\n?```$/, "").trim();
}

export function createMemoryLogId(prefix: string = "mlog"): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 6)}`;
}

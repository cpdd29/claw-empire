import type { AgentRole, CliProvider } from "../../types";
import type { DeptForm, FormData } from "./types";

export const ROLES: AgentRole[] = ["team_leader", "senior", "junior", "intern"];
export const CLI_PROVIDERS: CliProvider[] = [
  "claude",
  "codex",
  "gemini",
  "opencode",
  "kimi",
  "copilot",
  "antigravity",
  "api",
];

export const ROLE_LABEL: Record<string, { ko: string; en: string }> = {
  team_leader: { ko: "组长", en: "Leader" },
  senior: { ko: "高级", en: "Senior" },
  junior: { ko: "初级", en: "Junior" },
  intern: { ko: "实习生", en: "Intern" },
};

export const ROLE_BADGE: Record<string, string> = {
  team_leader: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  senior: "bg-sky-500/15 text-sky-400 border-sky-500/25",
  junior: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  intern: "bg-slate-500/15 text-slate-400 border-slate-500/25",
};

export const STATUS_DOT: Record<string, string> = {
  working: "bg-emerald-400 shadow-emerald-400/50 shadow-sm",
  break: "bg-amber-400",
  offline: "bg-red-400",
  idle: "bg-slate-500",
};

export const ICON_SPRITE_POOL = Array.from({ length: 13 }, (_, i) => i + 1);

export const EMOJI_GROUPS: { label: string; labelEn: string; emojis: string[] }[] = [
  {
    label: "部门/工作",
    labelEn: "Work",
    emojis: ["📊", "💻", "🎨", "🔍", "🛡️", "⚙️", "📁", "🏢", "📋", "📈", "💼", "🗂️", "📌", "🎯", "🔧", "🧪"],
  },
  {
    label: "人物/表情",
    labelEn: "People",
    emojis: ["🤖", "👤", "👥", "😊", "😎", "🤓", "🧑‍💻", "👨‍🔬", "👩‍🎨", "🧑‍🏫", "🦸", "🦊", "🐱", "🐶", "🐻", "🐼"],
  },
  {
    label: "物件/符号",
    labelEn: "Objects",
    emojis: ["💡", "🚀", "⚡", "🔥", "💎", "🏆", "🎵", "🎮", "📱", "💾", "🖥️", "📡", "🔑", "🛠️", "📦", "🧩"],
  },
  {
    label: "自然/颜色",
    labelEn: "Nature",
    emojis: ["🌟", "⭐", "🌈", "🌊", "🌸", "🍀", "🌙", "☀️", "❄️", "🔵", "🟢", "🟡", "🔴", "🟣", "🟠", "⚪"],
  },
];

export const BLANK: FormData = {
  name: "",
  name_ko: "",
  name_ja: "",
  name_zh: "",
  office_id: "",
  department_id: "",
  role: "junior",
  tier: 3,
  cli_provider: "claude",
  api_provider_id: "",
  avatar_emoji: "🤖",
  sprite_number: null,
  personality: "",
  agent_config: "",
  memory_config: "",
};

export const DEPT_BLANK: DeptForm = {
  id: "",
  name: "",
  name_ko: "",
  name_ja: "",
  name_zh: "",
  office_id: "",
  icon: "📁",
  description: "",
  prompt: "",
};

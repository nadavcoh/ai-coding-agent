// Chat history persisted to localStorage.
// Each conversation stores its messages and optional repo context.

import type { Message } from "ai";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
  repoContext?: { owner: string; repo: string };
  messages: Message[];
}

const STORAGE_KEY = "ai_agent_chat_history";
const MAX_SESSIONS = 30;

function load(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function save(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

export function listSessions(): ChatSession[] {
  return load().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSession(id: string): ChatSession | null {
  return load().find((s) => s.id === id) ?? null;
}

export function createSession(
  modelId: string,
  repoContext?: { owner: string; repo: string }
): ChatSession {
  const session: ChatSession = {
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: "New conversation",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    modelId,
    repoContext,
    messages: [],
  };
  const all = load();
  all.unshift(session);
  // Keep only the most recent N sessions
  save(all.slice(0, MAX_SESSIONS));
  return session;
}

export function updateSession(id: string, patch: Partial<ChatSession>) {
  const all = load();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...patch, updatedAt: Date.now() };
  save(all);
}

export function deleteSession(id: string) {
  save(load().filter((s) => s.id !== id));
}

/** Derive a title from the first user message (truncated). */
export function deriveTitleFromMessages(messages: Message[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first?.content) return "New conversation";
  const text = typeof first.content === "string"
    ? first.content
    : (first.content as { text?: string }[])?.[0]?.text ?? "New conversation";
  return text.length > 60 ? text.slice(0, 57) + "…" : text;
}

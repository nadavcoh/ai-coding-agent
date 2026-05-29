// Gemini model definitions with free-tier rate limits and capability ratings.
// RPM = Requests Per Minute, TPD = Tokens Per Day (free tier)
// Source: https://ai.google.dev/gemini-api/docs/models/gemini

export interface GeminiModel {
  id: string;
  label: string;
  description: string;
  // Free tier limits
  rpm: number;       // requests per minute
  tpm: number;       // tokens per minute
  tpd: number;       // tokens per day
  rpd: number;       // requests per day
  // Ratings 1-5
  speed: number;
  intelligence: number;
  contextWindow: number; // in thousands of tokens
  recommended?: boolean;
}

export const GEMINI_MODELS: GeminiModel[] = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Best balance of speed and intelligence. Great for most coding tasks.",
    rpm: 10,
    tpm: 250_000,
    tpd: 1_000_000,
    rpd: 500,
    speed: 4,
    intelligence: 5,
    contextWindow: 1000,
    recommended: true,
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Most powerful reasoning. Use for complex refactors and architecture.",
    rpm: 5,
    tpm: 250_000,
    tpd: 1_000_000,
    rpd: 25,
    speed: 2,
    intelligence: 5,
    contextWindow: 1000,
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    description: "Fast and capable. Good for quick exploration and simple edits.",
    rpm: 15,
    tpm: 1_000_000,
    tpd: 1_500_000,
    rpd: 1500,
    speed: 5,
    intelligence: 4,
    contextWindow: 1000,
  },
  {
    id: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    description: "High rate limits. Use when you've hit limits on newer models.",
    rpm: 15,
    tpm: 1_000_000,
    tpd: 1_500_000,
    rpd: 1500,
    speed: 5,
    intelligence: 3,
    contextWindow: 1000,
  },
  {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    description: "Long context, lower limits. Good for reading large codebases.",
    rpm: 2,
    tpm: 32_000,
    tpd: 50_000,
    rpd: 50,
    speed: 2,
    intelligence: 4,
    contextWindow: 2000,
  },
];

export const DEFAULT_MODEL = "gemini-2.5-flash";

export function getModel(id: string): GeminiModel {
  return GEMINI_MODELS.find((m) => m.id === id) ?? GEMINI_MODELS[0];
}

// Per-model usage tracking stored in localStorage
export interface ModelUsage {
  requestsThisMinute: number;
  requestsToday: number;
  lastMinuteReset: number; // timestamp ms
  lastDayReset: number;    // timestamp ms
  lastRateLimitAt?: number;
}

const STORAGE_KEY = "gemini_model_usage";

function loadUsage(): Record<string, ModelUsage> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUsage(usage: Record<string, ModelUsage>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {}
}

function freshUsage(): ModelUsage {
  const now = Date.now();
  return {
    requestsThisMinute: 0,
    requestsToday: 0,
    lastMinuteReset: now,
    lastDayReset: now,
  };
}

function decayUsage(u: ModelUsage): ModelUsage {
  const now = Date.now();
  let next = { ...u };
  if (now - next.lastMinuteReset > 60_000) {
    next.requestsThisMinute = 0;
    next.lastMinuteReset = now;
  }
  if (now - next.lastDayReset > 86_400_000) {
    next.requestsToday = 0;
    next.lastDayReset = now;
  }
  return next;
}

export function recordRequest(modelId: string) {
  const all = loadUsage();
  const u = decayUsage(all[modelId] ?? freshUsage());
  u.requestsThisMinute += 1;
  u.requestsToday += 1;
  all[modelId] = u;
  saveUsage(all);
}

export function recordRateLimit(modelId: string) {
  const all = loadUsage();
  const u = decayUsage(all[modelId] ?? freshUsage());
  u.lastRateLimitAt = Date.now();
  all[modelId] = u;
  saveUsage(all);
}

export function getUsage(modelId: string): ModelUsage {
  const all = loadUsage();
  return decayUsage(all[modelId] ?? freshUsage());
}

export function remainingRpm(model: GeminiModel): number {
  const u = getUsage(model.id);
  return Math.max(0, model.rpm - u.requestsThisMinute);
}

export function remainingRpd(model: GeminiModel): number {
  const u = getUsage(model.id);
  return Math.max(0, model.rpd - u.requestsToday);
}

export function isModelHealthy(model: GeminiModel): boolean {
  const u = getUsage(model.id);
  if (u.lastRateLimitAt && Date.now() - u.lastRateLimitAt < 90_000) return false;
  return remainingRpm(model) > 0 && remainingRpd(model) > 0;
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileIcon(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    ts: "🟦",
    tsx: "⚛️",
    js: "🟨",
    jsx: "⚛️",
    py: "🐍",
    rs: "🦀",
    go: "🐹",
    json: "📋",
    md: "📝",
    css: "🎨",
    html: "🌐",
    yml: "⚙️",
    yaml: "⚙️",
    env: "🔑",
    sh: "📜",
    dockerfile: "🐳",
    gitignore: "👻",
    lock: "🔒",
  };
  return iconMap[ext || ""] || "📄";
}

export function truncateMiddle(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  const half = Math.floor((maxLength - 3) / 2);
  return `${str.slice(0, half)}...${str.slice(-half)}`;
}

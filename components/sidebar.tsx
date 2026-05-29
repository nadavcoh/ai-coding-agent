"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Github,
  Lock,
  Unlock,
  RefreshCw,
  Plus,
  ChevronRight,
  PanelLeftClose,
  X,
  MessageSquare,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";
import {
  listSessions,
  deleteSession,
  type ChatSession,
} from "@/lib/chat-history";

interface Repo {
  owner: string;
  repo: string;
  full_name: string;
  private: boolean;
}

interface SidebarProps {
  activeRepo?: string;
  activeChatId?: string;
  onSelectRepo: (repo: Repo) => void;
  onSelectChat: (session: ChatSession) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onToggle: () => void;
  historyTick: number; // increment to force re-render history
}

export function Sidebar({
  activeRepo,
  activeChatId,
  onSelectRepo,
  onSelectChat,
  onNewChat,
  isOpen,
  onToggle,
  historyTick,
}: SidebarProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [reposExpanded, setReposExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true);

  const fetchRepos = async () => {
    setRepoLoading(true);
    setRepoError(null);
    try {
      const res = await fetch("/api/github/repos");
      const data = await res.json();
      if (data.error) setRepoError(data.error);
      else setRepos(data.repos || []);
    } catch {
      setRepoError("Failed to load repositories");
    } finally {
      setRepoLoading(false);
    }
  };

  const refreshHistory = useCallback(() => {
    setSessions(listSessions());
  }, []);

  useEffect(() => { fetchRepos(); }, []);
  useEffect(() => { refreshHistory(); }, [historyTick, refreshHistory]);

  const close = () => {
    if (window.innerWidth < 768) onToggle();
  };

  const handleSelectRepo = (repo: Repo) => {
    onSelectRepo(repo);
    close();
  };

  const handleSelectChat = (session: ChatSession) => {
    onSelectChat(session);
    close();
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSession(id);
    refreshHistory();
  };

  const handleNewChat = () => {
    onNewChat();
    close();
  };

  const formatRelative = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col bg-card border-r border-border transition-transform duration-300 ease-in-out w-[280px]",
          "md:relative md:translate-x-0 md:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full md:-translate-x-full"
        )}
      >
        {/* Brand + close */}
        <div className="px-4 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white text-sm font-bold font-display">AI</span>
            </div>
            <div>
              <h1 className="font-display text-sm font-bold text-foreground leading-none">Coding Agent</h1>
              <p className="text-xs text-muted-foreground mt-0.5">GitHub × Gemini</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4 md:hidden" />
            <PanelLeftClose className="h-4 w-4 hidden md:block" />
          </button>
        </div>

        {/* New Chat */}
        <div className="px-3 pt-3 shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-dashed border-border/60 hover:border-border"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>New conversation</span>
          </button>
        </div>

        <ScrollArea className="flex-1 px-2 mt-2">
          {/* ── Chat History ── */}
          <button
            onClick={() => setHistoryExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>History</span>
            <ChevronDown className={cn("h-3 w-3 transition-transform", historyExpanded && "rotate-180")} />
          </button>

          {historyExpanded && (
            <div className="space-y-0.5 mb-3">
              {sessions.length === 0 ? (
                <p className="px-3 py-1.5 text-[11px] text-muted-foreground/50">No conversations yet</p>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectChat(s)}
                    className={cn(
                      "w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left transition-all group",
                      activeChatId === s.id
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate leading-snug">{s.title}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5 flex items-center gap-1.5">
                        {s.repoContext && (
                          <span className="font-mono truncate max-w-[80px]">{s.repoContext.repo}</span>
                        )}
                        <span>{formatRelative(s.updatedAt)}</span>
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(e, s.id)}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-0.5 rounded hover:text-destructive shrink-0"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </button>
                ))
              )}
            </div>
          )}

          {/* ── Repositories ── */}
          <div className="flex items-center justify-between px-3 py-2">
            <button
              onClick={() => setReposExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              Repositories
              <ChevronDown className={cn("h-3 w-3 transition-transform", reposExpanded && "rotate-180")} />
            </button>
            <button
              onClick={fetchRepos}
              disabled={repoLoading}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn("h-3 w-3", repoLoading && "animate-spin")} />
            </button>
          </div>

          {reposExpanded && (
            <div className="space-y-0.5 pb-4">
              {repoError ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  <p className="text-destructive/70 mb-1">{repoError}</p>
                  <p className="text-[11px]">Add GITHUB_TOKEN to see your repos</p>
                </div>
              ) : repoLoading ? (
                <div className="px-3 space-y-1.5 py-1">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-8 rounded-md bg-muted/40 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
              ) : repos.length === 0 ? (
                <p className="px-3 py-1.5 text-[11px] text-muted-foreground/50">No repos with write access</p>
              ) : (
                repos.map((repo) => (
                  <button
                    key={repo.full_name}
                    onClick={() => handleSelectRepo(repo)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all group",
                      activeRepo === repo.full_name
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <Github className="h-3.5 w-3.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{repo.repo}</div>
                      <div className="text-[10px] text-muted-foreground/60 truncate">{repo.owner}</div>
                    </div>
                    {repo.private
                      ? <Lock className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                      : <Unlock className="h-3 w-3 shrink-0 text-muted-foreground/25" />}
                    <ChevronRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                ))
              )}
            </div>
          )}
        </ScrollArea>

        <div className="px-4 py-3 border-t border-border shrink-0">
          <p className="text-[10px] text-muted-foreground/40 text-center">All pushes require human approval</p>
        </div>
      </aside>
    </>
  );
}

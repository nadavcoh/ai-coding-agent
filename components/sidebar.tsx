"use client";

import { useEffect, useState } from "react";
import { Github, Lock, Unlock, RefreshCw, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";

interface Repo {
  owner: string;
  repo: string;
  full_name: string;
  private: boolean;
}

interface SidebarProps {
  activeRepo?: string;
  onSelectRepo: (repo: Repo) => void;
  onNewChat: () => void;
}

export function Sidebar({ activeRepo, onSelectRepo, onNewChat }: SidebarProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/github/repos");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setRepos(data.repos || []);
      }
    } catch {
      setError("Failed to load repositories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  return (
    <aside className="w-[var(--sidebar-width)] shrink-0 border-r border-border bg-card flex flex-col h-screen">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold font-display">AI</span>
          </div>
          <div>
            <h1 className="font-display text-sm font-bold text-foreground leading-none">
              Coding Agent
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">GitHub × Gemini</p>
          </div>
        </div>
      </div>

      {/* New Chat */}
      <div className="px-3 pt-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-dashed border-border/60 hover:border-border"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New conversation</span>
        </button>
      </div>

      {/* Repos */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Repositories
        </span>
        <button
          onClick={fetchRepos}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </button>
      </div>

      <ScrollArea className="flex-1 px-2">
        {error ? (
          <div className="px-3 py-3 text-xs text-muted-foreground">
            <p className="text-destructive/70 mb-1">{error}</p>
            <p className="text-[11px]">Add GITHUB_TOKEN to see your repos</p>
          </div>
        ) : loading ? (
          <div className="px-3 space-y-1.5 py-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-8 rounded-md bg-muted/40 animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        ) : repos.length === 0 ? (
          <div className="px-3 py-3 text-xs text-muted-foreground">
            No repositories found
          </div>
        ) : (
          <div className="space-y-0.5 pb-4 pt-1">
            {repos.map((repo) => (
              <button
                key={repo.full_name}
                onClick={() => onSelectRepo(repo)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all group",
                  activeRepo === repo.full_name
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Github className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs font-medium truncate flex-1">
                  {repo.repo}
                </span>
                {repo.private ? (
                  <Lock className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                ) : (
                  <Unlock className="h-3 w-3 shrink-0 text-muted-foreground/30" />
                )}
                <ChevronRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground/50 text-center">
          All pushes require human approval
        </p>
      </div>
    </aside>
  );
}

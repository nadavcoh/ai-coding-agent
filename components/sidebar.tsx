"use client";

import { useEffect, useState } from "react";
import {
  Github,
  Lock,
  Unlock,
  RefreshCw,
  Plus,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
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
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({
  activeRepo,
  onSelectRepo,
  onNewChat,
  isOpen,
  onToggle,
}: SidebarProps) {
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

  // Close sidebar on mobile when a repo is selected
  const handleSelectRepo = (repo: Repo) => {
    onSelectRepo(repo);
    // On small screens, auto-close after selection
    if (window.innerWidth < 768) {
      onToggle();
    }
  };

  const handleNewChat = () => {
    onNewChat();
    if (window.innerWidth < 768) {
      onToggle();
    }
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

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col bg-card border-r border-border transition-transform duration-300 ease-in-out",
          "w-[280px]",
          // Desktop: push layout; Mobile: overlay
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
              <h1 className="font-display text-sm font-bold text-foreground leading-none">
                Coding Agent
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">GitHub × Gemini</p>
            </div>
          </div>
          {/* Close button — visible on all screen sizes when sidebar is open */}
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

        {/* Repos header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Repositories
          </span>
          <button
            onClick={fetchRepos}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="Refresh repositories"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </button>
        </div>

        {/* Repo list */}
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
              No repositories with push access found
            </div>
          ) : (
            <div className="space-y-0.5 pb-4 pt-1">
              {repos.map((repo) => (
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
                  {repo.private ? (
                    <Lock className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                  ) : (
                    <Unlock className="h-3 w-3 shrink-0 text-muted-foreground/25" />
                  )}
                  <ChevronRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <p className="text-[10px] text-muted-foreground/40 text-center">
            All pushes require human approval
          </p>
        </div>
      </aside>
    </>
  );
}

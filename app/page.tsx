"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { getSession, type ChatSession } from "@/lib/chat-history";

interface RepoContext {
  owner: string;
  repo: string;
  full_name: string;
}

export default function Home() {
  const [activeRepo, setActiveRepo] = useState<RepoContext | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const handleSelectRepo = (repo: { owner: string; repo: string; full_name: string }) => {
    setActiveRepo(repo);
    setActiveSession(null);
    setActiveChatId(null);
    setChatKey((k) => k + 1);
  };

  const handleSelectChat = (session: ChatSession) => {
    setActiveSession(session);
    setActiveChatId(session.id);
    setActiveRepo(
      session.repoContext
        ? { owner: session.repoContext.owner, repo: session.repoContext.repo, full_name: `${session.repoContext.owner}/${session.repoContext.repo}` }
        : null
    );
    setChatKey((k) => k + 1);
  };

  const handleNewChat = () => {
    setActiveRepo(null);
    setActiveSession(null);
    setActiveChatId(null);
    setChatKey((k) => k + 1);
  };

  const handleSessionCreated = useCallback((id: string) => {
    setActiveChatId(id);
    setHistoryTick((t) => t + 1);
  }, []);

  const handleHistoryUpdate = useCallback(() => {
    setHistoryTick((t) => t + 1);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeRepo={activeRepo?.full_name}
        activeChatId={activeChatId ?? undefined}
        onSelectRepo={handleSelectRepo}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        historyTick={historyTick}
      />
      <main className="flex-1 min-w-0 overflow-hidden">
        <ChatInterface
          key={chatKey}
          initialSession={activeSession}
          repoContext={activeRepo ? { owner: activeRepo.owner, repo: activeRepo.repo } : undefined}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          onSessionCreated={handleSessionCreated}
          onHistoryUpdate={handleHistoryUpdate}
        />
      </main>
    </div>
  );
}

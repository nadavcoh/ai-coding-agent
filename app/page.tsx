"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatInterface } from "@/components/chat-interface";

interface RepoContext {
  owner: string;
  repo: string;
  full_name: string;
}

export default function Home() {
  const [activeRepo, setActiveRepo] = useState<RepoContext | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>();

  const handleSelectRepo = (repo: { owner: string; repo: string; full_name: string }) => {
    setActiveRepo(repo);
    setInitialPrompt(
      `Please explore the structure of ${repo.owner}/${repo.repo} and give me a brief overview of what this project does.`
    );
    setChatKey((k) => k + 1);
  };

  const handleNewChat = () => {
    setActiveRepo(null);
    setInitialPrompt(undefined);
    setChatKey((k) => k + 1);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeRepo={activeRepo?.full_name}
        onSelectRepo={handleSelectRepo}
        onNewChat={handleNewChat}
      />
      <main className="flex-1 min-w-0 overflow-hidden">
        <ChatInterface
          key={chatKey}
          initialPrompt={initialPrompt}
          repoContext={activeRepo ? { owner: activeRepo.owner, repo: activeRepo.repo } : undefined}
        />
      </main>
    </div>
  );
}

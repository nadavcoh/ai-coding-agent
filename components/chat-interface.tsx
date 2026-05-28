"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send,
  StopCircle,
  Bot,
  User,
  AlertTriangle,
  Sparkles,
  Github,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { MessageRenderer } from "./message-renderer";
import { DiffViewer } from "./diff-viewer";
import { ToolResultCard } from "./tool-result-card";
import { cn } from "@/lib/utils";
import type { Message } from "ai";

interface PendingPush {
  toolCallId: string;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  content: string;
  commitMessage: string;
  originalContent: string;
  approved?: boolean;
  commitUrl?: string;
}

interface ChatInterfaceProps {
  initialPrompt?: string;
  repoContext?: { owner: string; repo: string };
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function ChatInterface({ initialPrompt, repoContext, sidebarOpen, onToggleSidebar }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [pendingPushes, setPendingPushes] = useState<Map<string, PendingPush>>(new Map());

  const [chatError, setChatError] = useState<string | null>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    addToolResult,
    setInput,
  } = useChat({
    api: "/api/chat",
    maxSteps: 10,
    onError: (err) => {
      console.error("Chat error:", err);
      // The AI SDK wraps errors — try to extract a useful message
      const msg = err?.message || "";
      if (msg.includes("Rate limit") || msg.includes("quota") || msg.includes("429")) {
        setChatError("Rate limit reached. Please wait a moment and try again.");
      } else if (msg && msg !== "An error occurred." && msg !== "An error occurred") {
        setChatError(msg);
      } else {
        setChatError("Something went wrong. Check your API keys and try again.");
      }
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Pre-fill with initial prompt if provided
  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      inputRef.current?.focus();
    }
  }, [initialPrompt, setInput]);

  // Detect propose_github_push tool calls that need human approval
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role === "assistant" && msg.toolInvocations) {
        for (const ti of msg.toolInvocations) {
          if (
            ti.toolName === "propose_github_push" &&
            ti.state === "call" &&
            !pendingPushes.has(ti.toolCallId)
          ) {
            const args = ti.args as {
              owner: string;
              repo: string;
              branch: string;
              file_path: string;
              content: string;
              commit_message: string;
              original_content?: string;
            };

            setPendingPushes((prev) => {
              const next = new Map(prev);
              next.set(ti.toolCallId, {
                toolCallId: ti.toolCallId,
                owner: args.owner,
                repo: args.repo,
                branch: args.branch,
                filePath: args.file_path,
                content: args.content,
                commitMessage: args.commit_message,
                originalContent: args.original_content || "",
              });
              return next;
            });
          }
        }
      }
    }
  }, [messages, pendingPushes]);

  const handleApprovePush = useCallback(
    async (push: PendingPush) => {
      const res = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: push.owner,
          repo: push.repo,
          branch: push.branch,
          file_path: push.filePath,
          content: push.content,
          commit_message: push.commitMessage,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Push failed");
      }

      const data = await res.json();

      setPendingPushes((prev) => {
        const next = new Map(prev);
        const existing = next.get(push.toolCallId);
        if (existing) {
          next.set(push.toolCallId, {
            ...existing,
            approved: true,
            commitUrl: data.commitUrl,
          });
        }
        return next;
      });

      // Notify the AI that the push was approved
      addToolResult({
        toolCallId: push.toolCallId,
        result: {
          success: true,
          commitSha: data.commitSha,
          commitUrl: data.commitUrl,
          message: `Code successfully committed to ${push.owner}/${push.repo}@${push.branch}`,
        },
      });
    },
    [addToolResult]
  );

  const handleRejectPush = useCallback(
    (push: PendingPush) => {
      setPendingPushes((prev) => {
        const next = new Map(prev);
        next.delete(push.toolCallId);
        return next;
      });

      addToolResult({
        toolCallId: push.toolCallId,
        result: {
          success: false,
          message: "The human rejected this code change. Please revise your approach or ask for feedback.",
        },
      });
    },
    [addToolResult]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        setChatError(null);
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <div className="h-12 border-b border-border px-3 sm:px-5 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Hamburger / open-sidebar button */}
          {!sidebarOpen && (
            <button
              onClick={onToggleSidebar}
              className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
              aria-label="Open sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
          {repoContext && (
            <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
              <Github className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono text-xs truncate">
                {repoContext.owner}/{repoContext.repo}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={cn(
            "h-1.5 w-1.5 rounded-full",
            isLoading ? "bg-primary animate-pulse" : "bg-emerald-500"
          )} />
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {isLoading ? "Thinking…" : "Ready"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
      >
        {isEmpty ? (
          <EmptyState repoContext={repoContext} onPrompt={setInput} />
        ) : (
          <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-1">
            {messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                pendingPushes={pendingPushes}
                onApprovePush={handleApprovePush}
                onRejectPush={handleRejectPush}
              />
            ))}

            {isLoading && !messages.at(-1)?.content && (
              <div className="flex items-start gap-3 py-3">
                <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            {chatError && (
              <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive animate-fade-in">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-medium">Error: </span>
                  {chatError}
                </div>
                <button onClick={() => setChatError(null)} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-card/50 backdrop-blur px-3 sm:px-4 py-3 sm:py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 sm:gap-3 bg-secondary/50 border border-border rounded-xl px-3 sm:px-4 py-3 focus-within:border-primary/50 focus-within:shadow-sm transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                handleInputChange(e);
                // Auto-grow
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                repoContext
                  ? `Ask about ${repoContext.owner}/${repoContext.repo}…`
                  : "Ask me to explore a repo, review code, or propose changes…"
              }
              rows={4}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed overflow-y-auto"
              style={{ minHeight: "96px", maxHeight: "200px" }}
              disabled={isLoading}
            />
            <div className="flex items-center gap-2 shrink-0 pb-0.5">
              {isLoading ? (
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={stop}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <StopCircle className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  size="icon-sm"
                  onClick={(e) => {
                    setChatError(null);
                    handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
                  }}
                  disabled={!input.trim()}
                  className="shadow-sm"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/30 text-center mt-2 hidden sm:block">
            Enter to send · Shift+Enter for newline · All GitHub pushes require your approval
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Individual message row ─────────────────────────────────────────────────

function MessageRow({
  message,
  pendingPushes,
  onApprovePush,
  onRejectPush,
}: {
  message: Message;
  pendingPushes: Map<string, PendingPush>;
  onApprovePush: (push: PendingPush) => Promise<void>;
  onRejectPush: (push: PendingPush) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex items-start gap-3 py-2 animate-fade-in",
        isUser && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
        isUser
          ? "bg-accent/20 border border-accent/30"
          : "bg-primary/10 border border-primary/20"
      )}>
        {isUser ? (
          <User className="h-3.5 w-3.5 text-accent" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-primary" />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0 space-y-1", isUser && "flex flex-col items-end")}>
        {/* Text content */}
        {message.content && (
          <div className={cn(
            "rounded-xl px-4 py-3 text-sm max-w-[90%]",
            isUser
              ? "bg-accent/10 border border-accent/20 text-foreground"
              : "bg-transparent text-foreground"
          )}>
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <MessageRenderer content={message.content} />
            )}
          </div>
        )}

        {/* Tool invocations */}
        {message.toolInvocations?.map((ti) => {
          if (ti.toolName === "propose_github_push") {
            const pendingPush = pendingPushes.get(ti.toolCallId);
            if (!pendingPush) return null;

            return (
              <div key={ti.toolCallId} className="w-full">
                <DiffViewer
                  owner={pendingPush.owner}
                  repo={pendingPush.repo}
                  branch={pendingPush.branch}
                  filePath={pendingPush.filePath}
                  originalContent={pendingPush.originalContent}
                  proposedContent={pendingPush.content}
                  commitMessage={pendingPush.commitMessage}
                  onApprove={() => onApprovePush(pendingPush)}
                  onReject={() => onRejectPush(pendingPush)}
                  approved={pendingPush.approved}
                  commitUrl={pendingPush.commitUrl}
                />
              </div>
            );
          }

          return (
            <ToolResultCard
              key={ti.toolCallId}
              toolName={ti.toolName}
              args={ti.args as Record<string, unknown>}
              result={"result" in ti ? ti.result : undefined}
              state={
                ti.state === "call"
                  ? "running"
                  : ti.state === "result"
                  ? "complete"
                  : "pending"
              }
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({
  repoContext,
  onPrompt,
}: {
  repoContext?: { owner: string; repo: string };
  onPrompt: (p: string) => void;
}) {
  const suggestions = repoContext
    ? [
        `Explore the structure of ${repoContext.owner}/${repoContext.repo} and summarize what it does`,
        `Find and fix any obvious bugs in ${repoContext.owner}/${repoContext.repo}`,
        `Review the main entry point and suggest improvements`,
        `Add TypeScript types to any JavaScript files in this repo`,
      ]
    : [
        "Explore a repository and summarize its architecture",
        "Read a specific file and suggest refactoring improvements",
        "Help me add error handling to my Express routes",
        "Review my React components and propose performance optimizations",
      ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 sm:px-6 py-8 sm:py-12 text-center">
      <div className="mb-6 sm:mb-8">
        <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 flex items-center justify-center mx-auto mb-4 sm:mb-5 shadow-lg glow-primary">
          <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
        </div>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-2">
          AI Coding Agent
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Powered by Gemini. Reads and writes to GitHub with your approval.
          {repoContext && (
            <span className="block mt-1 font-mono text-xs text-primary">
              {repoContext.owner}/{repoContext.repo}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onPrompt(s)}
            className="text-left px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-border bg-card hover:bg-secondary hover:border-primary/30 transition-all text-sm text-muted-foreground hover:text-foreground group"
            style={{ animationDelay: `${i * 75}ms` }}
          >
            <span className="text-primary/60 group-hover:text-primary mr-1.5 transition-colors">›</span>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

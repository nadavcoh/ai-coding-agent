"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send, StopCircle, Bot, User, AlertTriangle,
  Sparkles, Github, PanelLeftOpen, RotateCcw,
} from "lucide-react";
import { Button } from "./ui/button";
import { ModelSelector } from "./model-selector";
import { MessageRenderer } from "./message-renderer";
import { DiffViewer } from "./diff-viewer";
import { ToolResultCard } from "./tool-result-card";
import { cn } from "@/lib/utils";
import {
  DEFAULT_MODEL, recordRequest, recordRateLimit,
  isModelHealthy, GEMINI_MODELS,
} from "@/lib/models";
import {
  createSession, updateSession, deriveTitleFromMessages,
  type ChatSession,
} from "@/lib/chat-history";
import type { Message } from "ai";

interface PendingPush {
  toolCallId: string;
  owner: string; repo: string; branch: string;
  filePath: string; content: string; commitMessage: string;
  originalContent: string; approved?: boolean; commitUrl?: string;
}

interface ChatInterfaceProps {
  initialSession?: ChatSession | null;
  repoContext?: { owner: string; repo: string };
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onSessionCreated?: (id: string) => void;
  onHistoryUpdate?: () => void;
  prefillInput?: string;
}

export function ChatInterface({
  initialSession, repoContext, sidebarOpen,
  onToggleSidebar, onSessionCreated, onHistoryUpdate, prefillInput,
}: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [pendingPushes, setPendingPushes] = useState<Map<string, PendingPush>>(new Map());
  const [chatError, setChatError] = useState<string | null>(null);
  const [rateLimitedModelId, setRateLimitedModelId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>(initialSession?.modelId ?? DEFAULT_MODEL);

  // Refs so callbacks always see current values without stale closures
  const modelIdRef = useRef(modelId);
  useEffect(() => { modelIdRef.current = modelId; }, [modelId]);

  // SESSION — use a ref to avoid stale closure bug where sessionId is null
  // even after setSessionId was called in the same effect run
  const sessionIdRef = useRef<string | null>(initialSession?.id ?? null);

  const {
    messages, input, handleInputChange, handleSubmit,
    isLoading, stop, addToolResult, setInput, setMessages, reload,
  } = useChat({
    api: "/api/chat",
    maxSteps: 10,
    initialMessages: initialSession?.messages ?? [],
    onError: (err) => {
      console.error("Chat error:", err);
      const msg = err?.message ?? "";
      // The AI SDK wraps non-200 responses — check for our RATE_LIMITED marker
      // or common rate limit keywords in the error
      const isRateLimit =
        msg.includes("RATE_LIMITED") ||
        msg.includes("429") ||
        msg.toLowerCase().includes("rate limit") ||
        msg.toLowerCase().includes("quota") ||
        msg.toLowerCase().includes("resource_exhausted");

      if (isRateLimit) {
        recordRateLimit(modelIdRef.current);
        setRateLimitedModelId(modelIdRef.current);
        setChatError("Rate limit reached. Switch to a different model or wait a moment.");
      } else if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
        setChatError("Invalid API key. Check GOOGLE_GENERATIVE_AI_API_KEY.");
      } else if (msg && msg !== "An error occurred." && msg !== "An error occurred") {
        setChatError(msg);
      } else {
        setChatError("Something went wrong. Please try again.");
      }
    },
    onFinish: () => {
      recordRequest(modelIdRef.current);
    },
  });

  // Pre-fill textarea when a repo is selected (editable starter prompt)
  useEffect(() => {
    if (prefillInput) {
      setInput(prefillInput);
      // Resize the textarea to fit the pre-filled text
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
        inputRef.current.focus();
      }
    }
  // Only run on mount (chatKey change remounts the component)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatError]);

  // Persist messages to localStorage session — use ref to avoid stale closure
  useEffect(() => {
    if (messages.length === 0) return;

    if (!sessionIdRef.current) {
      // First message: create a new session and store id in ref immediately
      const session = createSession(modelIdRef.current, repoContext);
      sessionIdRef.current = session.id; // ← ref update is synchronous, no stale closure
      updateSession(session.id, {
        messages,
        title: deriveTitleFromMessages(messages),
        modelId: modelIdRef.current,
        repoContext,
      });
      onSessionCreated?.(session.id);
    } else {
      updateSession(sessionIdRef.current, {
        messages,
        title: deriveTitleFromMessages(messages),
        modelId: modelIdRef.current,
      });
    }
    onHistoryUpdate?.();
  // Only re-run when messages actually change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Detect propose_github_push tool calls
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.toolInvocations) continue;
      for (const ti of msg.toolInvocations) {
        if (ti.toolName === "propose_github_push" && ti.state === "call" && !pendingPushes.has(ti.toolCallId)) {
          const args = ti.args as {
            owner: string; repo: string; branch: string;
            file_path: string; content: string; commit_message: string;
            original_content?: string;
          };
          setPendingPushes((prev) => {
            const next = new Map(prev);
            next.set(ti.toolCallId, {
              toolCallId: ti.toolCallId,
              owner: args.owner, repo: args.repo, branch: args.branch,
              filePath: args.file_path, content: args.content,
              commitMessage: args.commit_message,
              originalContent: args.original_content || "",
            });
            return next;
          });
        }
      }
    }
  }, [messages, pendingPushes]);

  const handleApprovePush = useCallback(async (push: PendingPush) => {
    const res = await fetch("/api/github/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: push.owner, repo: push.repo, branch: push.branch, file_path: push.filePath, content: push.content, commit_message: push.commitMessage }),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Push failed"); }
    const data = await res.json();
    setPendingPushes((prev) => {
      const next = new Map(prev);
      const ex = next.get(push.toolCallId);
      if (ex) next.set(push.toolCallId, { ...ex, approved: true, commitUrl: data.commitUrl });
      return next;
    });
    addToolResult({ toolCallId: push.toolCallId, result: { success: true, commitSha: data.commitSha, commitUrl: data.commitUrl } });
  }, [addToolResult]);

  const handleRejectPush = useCallback((push: PendingPush) => {
    setPendingPushes((prev) => { const next = new Map(prev); next.delete(push.toolCallId); return next; });
    addToolResult({ toolCallId: push.toolCallId, result: { success: false, message: "Change rejected by user." } });
  }, [addToolResult]);

  // Submit — pass modelId in body at call time (not via useChat body option)
  // This is the reliable pattern: the SDK accepts body overrides in handleSubmit options
  const doSubmit = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    setChatError(null);
    setRateLimitedModelId(null);
    handleSubmit(e as React.FormEvent<HTMLFormElement>, {
      body: { modelId: modelIdRef.current },
    });
  }, [input, isLoading, handleSubmit]);

  // Retry: strip the last (failed) assistant turn and re-send
  const handleRetry = useCallback(() => {
    setChatError(null);
    setRateLimitedModelId(null);
    // Find last user message and trim everything after it
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx >= 0) {
      const idx = messages.length - 1 - lastUserIdx;
      setMessages(messages.slice(0, idx + 1));
    }
    reload();
  }, [messages, setMessages, reload]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSubmit(e);
    }
  };

  // Scroll input into view on focus — accounts for mobile keyboard appearing
  const handleInputFocus = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 350);
  }, []);

  // When model changes: update ref synchronously so next submit uses new model
  const handleModelChange = useCallback((id: string) => {
    modelIdRef.current = id;
    setModelId(id);
    setChatError(null);
    setRateLimitedModelId(null);
  }, []);

  // Find the best alternate model to suggest after a rate limit
  const suggestedAlternative = rateLimitedModelId
    ? GEMINI_MODELS.find((m) => m.id !== rateLimitedModelId && isModelHealthy(m))
    : null;

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <div className="h-12 border-b border-border px-3 sm:px-5 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {!sidebarOpen && (
            <button onClick={onToggleSidebar} className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0" aria-label="Open sidebar">
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
          {repoContext && (
            <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
              <Github className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono text-xs truncate">{repoContext.owner}/{repoContext.repo}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={cn("h-1.5 w-1.5 rounded-full", isLoading ? "bg-primary animate-pulse" : "bg-emerald-500")} />
          <span className="text-xs text-muted-foreground hidden sm:inline">{isLoading ? "Thinking…" : "Ready"}</span>
          {/* ModelSelector key=modelId forces re-render when model changes */}
          <ModelSelector key={modelId} value={modelId} onChange={handleModelChange} />
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
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
                  {[0, 150, 300].map((d) => (
                    <div key={d} className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {chatError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive animate-fade-in overflow-hidden mt-2">
                <div className="flex items-start gap-2 py-2.5 px-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="flex-1">{chatError}</span>
                  <button onClick={() => { setChatError(null); setRateLimitedModelId(null); }} className="shrink-0 opacity-60 hover:opacity-100 text-xs px-1">✕</button>
                </div>

                <div className="px-3 pb-2.5 flex flex-wrap items-center gap-2">
                  {/* Retry */}
                  <button
                    onClick={handleRetry}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-destructive/30 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Retry
                  </button>

                  {/* Suggest switching to a healthier model */}
                  {suggestedAlternative && (
                    <>
                      <span className="text-xs text-destructive/60">or switch to:</span>
                      <button
                        onClick={() => handleModelChange(suggestedAlternative.id)}
                        className="text-xs px-2.5 py-1 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors font-medium"
                      >
                        {suggestedAlternative.label} →
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-card/50 backdrop-blur px-3 sm:px-4 py-3 sm:py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 sm:gap-3 bg-secondary/50 border border-border rounded-xl px-3 sm:px-4 py-3 focus-within:border-primary/50 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                handleInputChange(e);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={handleKeyDown}
              onFocus={handleInputFocus}
              placeholder={
                repoContext
                  ? `Ask about ${repoContext.owner}/${repoContext.repo}…`
                  : "Ask me to explore a repo, review code, or propose changes…"
              }
              rows={4}
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed overflow-y-auto"
              style={{ minHeight: "96px", maxHeight: "200px", fontSize: "16px" }}
              disabled={isLoading}
            />
            <div className="flex items-center gap-2 shrink-0 pb-0.5">
              {isLoading ? (
                <Button size="icon-sm" variant="outline" onClick={stop} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  <StopCircle className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="icon-sm" onClick={doSubmit} disabled={!input.trim()} className="shadow-sm">
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

// ─── Message row ──────────────────────────────────────────────────────────────

function MessageRow({ message, pendingPushes, onApprovePush, onRejectPush }: {
  message: Message;
  pendingPushes: Map<string, PendingPush>;
  onApprovePush: (p: PendingPush) => Promise<void>;
  onRejectPush: (p: PendingPush) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-start gap-3 py-2 animate-fade-in", isUser && "flex-row-reverse")}>
      <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5", isUser ? "bg-accent/20 border border-accent/30" : "bg-primary/10 border border-primary/20")}>
        {isUser ? <User className="h-3.5 w-3.5 text-accent" /> : <Bot className="h-3.5 w-3.5 text-primary" />}
      </div>
      <div className={cn("flex-1 min-w-0 space-y-1", isUser && "flex flex-col items-end")}>
        {message.content && (
          <div className={cn("rounded-xl px-4 py-3 text-sm max-w-[90%]", isUser ? "bg-accent/10 border border-accent/20 text-foreground" : "bg-transparent text-foreground")}>
            {isUser ? <p className="whitespace-pre-wrap">{message.content}</p> : <MessageRenderer content={message.content} />}
          </div>
        )}
        {message.toolInvocations?.map((ti) => {
          if (ti.toolName === "propose_github_push") {
            const p = pendingPushes.get(ti.toolCallId);
            if (!p) return null;
            return (
              <div key={ti.toolCallId} className="w-full">
                <DiffViewer owner={p.owner} repo={p.repo} branch={p.branch} filePath={p.filePath} originalContent={p.originalContent} proposedContent={p.content} commitMessage={p.commitMessage} onApprove={() => onApprovePush(p)} onReject={() => onRejectPush(p)} approved={p.approved} commitUrl={p.commitUrl} />
              </div>
            );
          }
          return (
            <ToolResultCard key={ti.toolCallId} toolName={ti.toolName} args={ti.args as Record<string, unknown>} result={"result" in ti ? ti.result : undefined} state={ti.state === "call" ? "running" : ti.state === "result" ? "complete" : "pending"} />
          );
        })}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ repoContext, onPrompt }: {
  repoContext?: { owner: string; repo: string };
  onPrompt: (p: string) => void;
}) {
  const repo = repoContext ? `${repoContext.owner}/${repoContext.repo}` : null;

  const suggestions = repo ? [
    `Explore the structure of ${repo} and summarize what it does`,
    `Find potential bugs or code quality issues in ${repo}`,
    `Review ${repo} and suggest refactoring improvements`,
    `Add or improve documentation in ${repo}`,
  ] : [
    "Explore a repository and summarize its architecture",
    "Review a file and suggest refactoring improvements",
    "Help me add error handling to my codebase",
    "Propose performance optimizations for my components",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 sm:px-6 py-8 sm:py-12 text-center">
      <div className="mb-6 sm:mb-8">
        <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 flex items-center justify-center mx-auto mb-4 sm:mb-5 shadow-lg glow-primary">
          <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
        </div>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-2">
          {repo ?? "AI Coding Agent"}
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {repo ? "Select a prompt below or type your own question." : "Powered by Gemini. Reads and writes to GitHub with your approval."}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full">
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => onPrompt(s)} className="text-left px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-border bg-card hover:bg-secondary hover:border-primary/30 transition-all text-sm text-muted-foreground hover:text-foreground group">
            <span className="text-primary/60 group-hover:text-primary mr-1.5 transition-colors">›</span>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

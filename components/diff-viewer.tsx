"use client";

import { useState } from "react";
import {
  GitBranch,
  GitCommit,
  CheckCircle,
  XCircle,
  Loader2,
  FileCode,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  lineNumber?: number;
}

function computeDiff(original: string, proposed: string): DiffLine[] {
  const origLines = original.split("\n");
  const propLines = proposed.split("\n");
  const result: DiffLine[] = [];

  // Simple line-by-line diff
  const maxLen = Math.max(origLines.length, propLines.length);
  let origIdx = 0;
  let propIdx = 0;

  // Use a simple LCS-based approach for better diffs
  const lcs = computeLCS(origLines, propLines);
  
  let lcsIdx = 0;
  origIdx = 0;
  propIdx = 0;

  while (origIdx < origLines.length || propIdx < propLines.length) {
    if (
      lcsIdx < lcs.length &&
      origIdx < origLines.length &&
      propIdx < propLines.length &&
      origLines[origIdx] === lcs[lcsIdx] &&
      propLines[propIdx] === lcs[lcsIdx]
    ) {
      result.push({ type: "context", content: origLines[origIdx], lineNumber: propIdx + 1 });
      origIdx++;
      propIdx++;
      lcsIdx++;
    } else if (
      propIdx < propLines.length &&
      (lcsIdx >= lcs.length || propLines[propIdx] !== lcs[lcsIdx])
    ) {
      result.push({ type: "add", content: propLines[propIdx], lineNumber: propIdx + 1 });
      propIdx++;
    } else if (origIdx < origLines.length) {
      result.push({ type: "remove", content: origLines[origIdx] });
      origIdx++;
    }
  }

  return result;
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = Math.min(a.length, 50); // Limit for performance
  const n = Math.min(b.length, 50);
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return lcs;
}

interface DiffViewerProps {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  originalContent: string;
  proposedContent: string;
  commitMessage: string;
  onApprove: () => Promise<void>;
  onReject: () => void;
  approved?: boolean;
  commitUrl?: string;
}

export function DiffViewer({
  owner,
  repo,
  branch,
  filePath,
  originalContent,
  proposedContent,
  commitMessage,
  onApprove,
  onReject,
  approved,
  commitUrl,
}: DiffViewerProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    approved ? "success" : "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showFull, setShowFull] = useState(false);

  const diffLines = computeDiff(originalContent, proposedContent);
  const addedCount = diffLines.filter((l) => l.type === "add").length;
  const removedCount = diffLines.filter((l) => l.type === "remove").length;

  const visibleLines = showFull ? diffLines : diffLines.slice(0, 60);
  const hasMore = diffLines.length > 60;

  const handleApprove = async () => {
    setStatus("loading");
    setErrorMessage("");
    try {
      await onApprove();
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Push failed");
    }
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card animate-fade-in my-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Proposed Commit
            </span>
            {status === "success" && (
              <Badge variant="success" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Committed
              </Badge>
            )}
          </div>
          <p className="text-sm font-mono text-foreground truncate">{commitMessage}</p>
        </div>
      </div>

      {/* Metadata */}
      <div className="px-4 py-2.5 border-b border-border bg-muted/10 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FileCode className="h-3.5 w-3.5" />
          <span className="font-mono">{filePath}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5" />
          <span>{owner}/{repo}</span>
          <span className="text-border">›</span>
          <span className="text-primary">{branch}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-emerald-400">+{addedCount}</span>
          <span className="text-red-400">-{removedCount}</span>
        </span>
      </div>

      {/* Diff */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs font-mono">
          <tbody>
            {visibleLines.map((line, idx) => (
              <tr
                key={idx}
                className={cn(
                  "leading-5",
                  line.type === "add" && "bg-emerald-500/8 hover:bg-emerald-500/12",
                  line.type === "remove" && "bg-red-500/8 hover:bg-red-500/12",
                  line.type === "context" && "hover:bg-muted/30"
                )}
              >
                <td
                  className={cn(
                    "pl-3 pr-2 py-0.5 select-none w-6 text-right border-r border-border/50",
                    line.type === "add" && "text-emerald-600 border-emerald-500/20",
                    line.type === "remove" && "text-red-600 border-red-500/20",
                    line.type === "context" && "text-muted-foreground/50"
                  )}
                >
                  {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
                </td>
                <td className="px-3 py-0.5 whitespace-pre text-foreground/90">
                  {line.content || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && !showFull && (
          <button
            onClick={() => setShowFull(true)}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-center"
          >
            Show {diffLines.length - 60} more lines…
          </button>
        )}
      </div>

      {/* Actions */}
      {status === "success" ? (
        <div className="px-4 py-3 border-t border-border bg-emerald-500/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            <span>Successfully committed to GitHub</span>
          </div>
          {commitUrl && (
            <a
              href={commitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View commit
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          {status === "error" && (
            <div className="flex items-center gap-2 text-xs text-destructive w-full sm:w-auto">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onReject}
              disabled={status === "loading"}
              className="text-muted-foreground hover:text-destructive hover:border-destructive/50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={status === "loading"}
              className="gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium shadow-sm"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="hidden sm:inline">Committing…</span>
                </>
              ) : (
                <>
                  <GitCommit className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Approve & Commit to GitHub</span>
                  <span className="sm:hidden">Approve</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

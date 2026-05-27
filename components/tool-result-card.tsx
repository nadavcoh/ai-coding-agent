"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, File, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileIcon } from "@/lib/utils";

interface ToolResultCardProps {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  state: "pending" | "running" | "complete" | "error";
}

export function ToolResultCard({ toolName, args, result, state }: ToolResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  const toolLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    read_repository_structure: {
      label: "Reading repository structure",
      icon: <Folder className="h-3.5 w-3.5" />,
    },
    read_file_contents: {
      label: `Reading ${(args.file_path as string) || "file"}`,
      icon: <File className="h-3.5 w-3.5" />,
    },
    propose_github_push: {
      label: "Preparing code proposal",
      icon: null,
    },
  };

  const info = toolLabels[toolName] || { label: toolName, icon: null };

  return (
    <div className={cn(
      "my-2 rounded-lg border text-xs transition-all",
      state === "complete" && "border-border/60 bg-muted/20",
      state === "running" && "border-primary/30 bg-primary/5",
      state === "error" && "border-destructive/30 bg-destructive/5",
      state === "pending" && "border-border/30 bg-muted/10"
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-muted-foreground">{info.icon}</span>
        <span className="text-muted-foreground font-medium flex-1">{info.label}</span>
        <span className="text-muted-foreground">
          {state === "running" && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          {state === "complete" && <CheckCircle className="h-3 w-3 text-emerald-400" />}
          {state === "error" && <XCircle className="h-3 w-3 text-destructive" />}
        </span>
        {result && (
          expanded
            ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
            : <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      {expanded && result && (
        <div className="px-3 pb-2 border-t border-border/50 mt-1 pt-2">
          <ToolResultContent toolName={toolName} result={result} />
        </div>
      )}
    </div>
  );
}

function ToolResultContent({ toolName, result }: { toolName: string; result: unknown }) {
  const r = result as Record<string, unknown>;

  if (toolName === "read_repository_structure" && r.files) {
    const files = r.files as Array<{ path: string; type: string }>;
    return (
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {files.slice(0, 100).map((f, i) => (
          <div key={i} className="flex items-center gap-1.5 py-0.5 text-muted-foreground hover:text-foreground">
            <span>{f.type === "dir" ? "📁" : getFileIcon(f.path)}</span>
            <span className="font-mono truncate">{f.path}</span>
          </div>
        ))}
        {files.length > 100 && (
          <div className="text-muted-foreground/60 py-1">+{files.length - 100} more files</div>
        )}
      </div>
    );
  }

  if (toolName === "read_file_contents" && r.content) {
    const content = r.content as string;
    const lines = content.split("\n");
    return (
      <div className="space-y-1">
        <div className="text-muted-foreground/60">{lines.length} lines · {(content.length / 1024).toFixed(1)} KB</div>
        <pre className="max-h-32 overflow-y-auto text-[11px] font-mono text-muted-foreground leading-relaxed">
          {lines.slice(0, 20).join("\n")}
          {lines.length > 20 && "\n..."}
        </pre>
      </div>
    );
  }

  return (
    <pre className="max-h-32 overflow-y-auto text-[11px] font-mono text-muted-foreground">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

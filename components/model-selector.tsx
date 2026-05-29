"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Zap, Brain, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GEMINI_MODELS,
  getModel,
  remainingRpm,
  remainingRpd,
  isModelHealthy,
  type GeminiModel,
} from "@/lib/models";

function StarRating({ value, max = 5, color = "text-primary" }: { value: number; max?: number; color?: string }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={cn("text-[8px]", i < value ? color : "text-muted-foreground/25")}>
          ●
        </span>
      ))}
    </span>
  );
}

function UsageBar({ used, total, warn }: { used: number; total: number; warn?: boolean }) {
  const pct = Math.min(100, (used / total) * 100);
  const remaining = total - used;
  const low = remaining <= total * 0.15;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            low || warn ? "bg-destructive/70" : "bg-primary/60"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-[10px] tabular-nums shrink-0", low || warn ? "text-destructive" : "text-muted-foreground")}>
        {remaining.toLocaleString()} left
      </span>
    </div>
  );
}

interface ModelRowProps {
  model: GeminiModel;
  selected: boolean;
  onClick: () => void;
  rpmRemaining: number;
  rpdRemaining: number;
  healthy: boolean;
}

function ModelRow({ model, selected, onClick, rpmRemaining, rpdRemaining, healthy }: ModelRowProps) {
  const rateLimited = !healthy && rpmRemaining === 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg transition-all border",
        selected
          ? "bg-primary/10 border-primary/30 text-foreground"
          : "bg-transparent border-transparent hover:bg-secondary text-muted-foreground hover:text-foreground",
        !healthy && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium truncate">{model.label}</span>
            {model.recommended && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium shrink-0">
                Recommended
              </span>
            )}
            {!healthy && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-medium shrink-0 flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {rateLimited ? "Rate limited" : "Near limit"}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{model.description}</p>
        </div>
        {selected && <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
      </div>

      {/* Ratings row */}
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1">
          <Zap className="h-2.5 w-2.5 text-muted-foreground/60" />
          <StarRating value={model.speed} color="text-yellow-400" />
        </div>
        <div className="flex items-center gap-1">
          <Brain className="h-2.5 w-2.5 text-muted-foreground/60" />
          <StarRating value={model.intelligence} color="text-primary" />
        </div>
        <span className="text-[9px] text-muted-foreground/60 ml-auto">{model.contextWindow}K ctx</span>
      </div>

      {/* Usage bars */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground/50 w-7 shrink-0">RPM</span>
          <UsageBar used={model.rpm - rpmRemaining} total={model.rpm} warn={rpmRemaining === 0} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground/50 w-7 shrink-0">RPD</span>
          <UsageBar used={model.rpd - rpdRemaining} total={model.rpd} warn={rpdRemaining === 0} />
        </div>
      </div>
    </button>
  );
}

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [usageSnapshot, setUsageSnapshot] = useState(0); // tick to re-render usage
  const ref = useRef<HTMLDivElement>(null);
  const model = getModel(value);

  // Refresh usage display every 10s
  useEffect(() => {
    const id = setInterval(() => setUsageSnapshot((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const healthy = isModelHealthy(model);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all",
          open
            ? "bg-secondary border-border text-foreground"
            : "bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
          !healthy && "border-destructive/40 text-destructive"
        )}
      >
        {!healthy && <AlertTriangle className="h-3 w-3" />}
        <span className="font-medium max-w-[120px] truncate">{model.label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-72 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Select Model · Free Tier Limits
            </p>
          </div>
          <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
            {GEMINI_MODELS.map((m) => (
              <ModelRow
                key={m.id}
                model={m}
                selected={m.id === value}
                onClick={() => { onChange(m.id); setOpen(false); }}
                rpmRemaining={remainingRpm(m)}
                rpdRemaining={remainingRpd(m)}
                healthy={isModelHealthy(m)}
              />
            ))}
          </div>
          <div className="px-3 py-2 border-t border-border">
            <p className="text-[9px] text-muted-foreground/40 text-center">
              Usage resets every minute (RPM) and daily (RPD)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

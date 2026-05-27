"use client";

import ReactMarkdown from "react-markdown";
import { CodeBlock } from "./code-block";

interface MessageRendererProps {
  content: string;
}

export function MessageRenderer({ content }: MessageRendererProps) {
  return (
    <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-foreground/90">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const code = String(children).replace(/\n$/, "");
            const isInline = !className && !code.includes("\n");

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-muted text-primary font-mono text-[0.85em]"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock
                code={code}
                language={language}
                className="my-3"
              />
            );
          },
          pre({ children }) {
            // Let code handle the pre rendering
            return <>{children}</>;
          },
          p({ children }) {
            return <p className="mb-3 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-foreground/85">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-lg font-semibold font-display text-foreground mb-3 mt-4">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-semibold font-display text-foreground mb-2 mt-3">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-semibold text-foreground mb-2 mt-3">{children}</h3>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-primary/40 pl-3 my-3 text-muted-foreground italic">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="text-xs border-collapse w-full">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="border border-border px-3 py-1.5 text-left font-medium bg-muted/50">{children}</th>;
          },
          td({ children }) {
            return <td className="border border-border px-3 py-1.5">{children}</td>;
          },
          hr() {
            return <hr className="border-border my-4" />;
          },
          strong({ children }) {
            return <strong className="font-semibold text-foreground">{children}</strong>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

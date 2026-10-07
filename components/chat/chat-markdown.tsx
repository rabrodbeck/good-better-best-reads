"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMarkdownProps {
  content: string;
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="chat-markdown text-sm leading-relaxed max-w-none space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ ...props }) => (
            <h3 className="text-base font-bold text-foreground mt-3 mb-1.5 first:mt-0 tracking-tight" {...props} />
          ),
          h2: ({ ...props }) => (
            <h4 className="text-sm font-bold text-foreground mt-2.5 mb-1 first:mt-0 tracking-tight" {...props} />
          ),
          h3: ({ ...props }) => (
            <h5 className="text-sm font-semibold text-foreground mt-2 mb-1 first:mt-0" {...props} />
          ),
          p: ({ ...props }) => <p className="mb-2 last:mb-0 leading-relaxed text-foreground/90" {...props} />,
          ul: ({ ...props }) => (
            <ul className="list-disc list-outside pl-4 mb-2 space-y-1 text-foreground/90 marker:text-primary/70" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="list-decimal list-outside pl-4 mb-2 space-y-1 text-foreground/90 marker:text-primary/70" {...props} />
          ),
          li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
          strong: ({ ...props }) => <strong className="font-semibold text-foreground" {...props} />,
          em: ({ ...props }) => <em className="italic text-foreground/95" {...props} />,
          blockquote: ({ ...props }) => (
            <blockquote
              className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground my-2 bg-muted/20 py-0.5 rounded-r"
              {...props}
            />
          ),
          code: ({ className, children, ...props }) => {
            return (
              <code
                className="rounded bg-muted/80 px-1.5 py-0.5 text-xs font-mono text-foreground border border-border/40"
                {...props}
              >
                {children}
              </code>
            );
          },
          hr: ({ ...props }) => <hr className="my-2.5 border-border/50" {...props} />,
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity font-medium"
              {...props}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkles, Bot, User, ArrowUp, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookCard } from "@/components/chat/book-card";

const SUGGESTIONS = [
  "What should I read next based on my 5-star favorites?",
  "A fast-paced survival thriller with an impossible problem, zero romance.",
  "Something psychological and twisty like Gillian Flynn or Karin Slaughter.",
  "A sci-fi adventure under 350 pages that gets straight to the point.",
];

export default function ChatPage() {
  const [input, setInput] = React.useState("");
  const [profile, setProfile] = React.useState<{
    archetype_name: string;
    preferred_pacing?: string;
  } | null>(null);

  React.useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data?.tasteProfile) {
          setProfile(data.tasteProfile);
        }
      })
      .catch((err) => console.error("Could not load profile:", err));
  }, []);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as streaming chunks arrive
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    await sendMessage({ text });
  };

  return (
    <div className="container mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col p-4 sm:p-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">Personal Librarian</h1>
              <Badge variant="secondary" className="text-[10px] text-primary">
                Gemini 2.5 Flash
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Trained on your reading history &bull; Explainable recommendations
            </p>
          </div>
        </div>

        {profile ? (
          <Badge variant="outline" className="hidden sm:inline-flex border-emerald-500/30 text-emerald-500 gap-1 text-xs">
            <Zap className="size-3" />
            {profile.archetype_name}
          </Badge>
        ) : (
          <Link href="/import">
            <Badge variant="outline" className="hidden sm:inline-flex border-amber-500/30 text-amber-500 hover:bg-amber-500/10 transition-colors gap-1 text-xs cursor-pointer">
              <Sparkles className="size-3" />
              Import CSV to personalize &rarr;
            </Badge>
          </Link>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
              <Bot className="size-6" />
            </div>
            <h3 className="text-base font-semibold">Your Personal Librarian is ready</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1 mb-8">
              Ask for books that match your exact pacing, tropes, or mood. Never worry about generic bestseller lists again.
            </p>

            {/* Suggestion Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl text-left">
              {SUGGESTIONS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage({ text: prompt })}
                  className="rounded-xl border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-card/80 transition-all text-left"
                >
                  &ldquo;{prompt}&rdquo;
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isUser = message.role === "user";

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 mt-1">
                    <Sparkles className="size-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? "bg-primary text-primary-foreground font-medium"
                      : "bg-card/70 border border-border/50 text-foreground backdrop-blur-xs"
                  }`}
                >
                  {/* Render Message Parts */}
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return (
                        <div key={index} className="whitespace-pre-wrap">
                          {part.text}
                        </div>
                      );
                    }

                    // Render Book Card from Tool Results
                    if (
                      part.type === "tool-lookup_book_cover" &&
                      part.state === "output-available" &&
                      (part.output as { found?: boolean })?.found
                    ) {
                      const book = part.output as {
                        title: string;
                        author: string;
                        coverUrl?: string | null;
                        publishedYear?: number | null;
                        pageCount?: number | null;
                      };
                      return (
                        <BookCard
                          key={index}
                          title={book.title}
                          author={book.author}
                          coverUrl={book.coverUrl}
                          publishedYear={book.publishedYear}
                          pageCount={book.pageCount}
                        />
                      );
                    }

                    return null;
                  })}
                </div>

                {isUser && (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground mt-1">
                    <User className="size-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
            <RefreshCw className="size-3.5 animate-spin text-primary" />
            <span>The Librarian is analyzing your Reading DNA...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2 pt-2 border-t border-border/40">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your Personal Librarian (e.g. 'A survival thriller with a clever twist')..."
          className="flex-1 bg-card/50"
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          <ArrowUp className="size-4" />
        </Button>
      </form>
    </div>
  );
}
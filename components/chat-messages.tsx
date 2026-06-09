"use client";

import { useRef, useEffect } from "react";
import { User, Bot, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessagesSkeleton } from "@/components/loading-skeleton";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  error?: string | null;
  loading?: boolean;
}

export function ChatMessages({
  messages,
  error,
  loading = false,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Loading state — show skeleton while fetching conversation history
  if (loading) {
    return <ChatMessagesSkeleton />;
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-semibold text-white mb-2">
          Haney Chat
        </h1>
        <p className="text-zinc-400 max-w-md">
          Your AI assistant powered by a 537M parameter language model.
        </p>
        <div className="flex flex-wrap gap-2 justify-center mt-8 max-w-lg">
          {[
            "Explain quantum computing",
            "Write a Python script",
            "Summarize an article",
            "Debug my code",
          ].map((suggestion) => (
            <span
              key={suggestion}
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400"
            >
              {suggestion}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3 sm:gap-4",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {/* Avatar */}
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}

            {/* Bubble */}
            <div
              className={cn(
                "max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-white text-black rounded-br-md"
                  : "bg-white/5 text-zinc-200 rounded-bl-md border border-white/5"
              )}
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap break-words">
                  {msg.content}
                </p>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&_pre]:bg-zinc-900 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:bg-zinc-800 [&_code]:rounded [&_code]:px-1 [&_code]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 break-words">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                  {msg.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                  )}
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-4 w-4 text-zinc-400" />
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="flex justify-center">
            <div className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

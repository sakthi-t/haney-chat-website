"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 8000;

interface ChatInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
}

export function ChatInput({ onSend, isStreaming }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = input.length;
  const isOverLimit = charCount > MAX_LENGTH;

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const scrollHeight = el.scrollHeight;
    el.style.height = Math.min(scrollHeight, 200) + "px";
  }, [input]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || isOverLimit) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-white/5 bg-zinc-950 px-4 py-4">
      <div className="max-w-3xl mx-auto flex items-end gap-3">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Haney…"
            disabled={isStreaming}
            rows={1}
            className={cn(
              "min-h-[44px] max-h-[200px] resize-none pr-16",
              "bg-white/5 border-white/10 text-white placeholder:text-zinc-500",
              "focus-visible:ring-purple-500/50 rounded-xl",
              isOverLimit && "border-red-500/50 focus-visible:ring-red-500/50"
            )}
          />
          {/* Character count */}
          {charCount > 0 && (
            <span
              className={cn(
                "absolute bottom-2 right-3 text-xs tabular-nums",
                isOverLimit ? "text-red-400" : "text-zinc-600",
                isStreaming && "opacity-50"
              )}
            >
              {charCount}/{MAX_LENGTH}
            </span>
          )}
        </div>
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming || isOverLimit}
          size="icon"
          className={cn(
            "h-11 w-11 rounded-xl shrink-0",
            "bg-white text-black hover:bg-zinc-200",
            "disabled:opacity-30 disabled:cursor-not-allowed"
          )}
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-center text-xs text-zinc-600 mt-3">
        Haney Chat 537M — responses may be inaccurate.
      </p>
    </div>
  );
}

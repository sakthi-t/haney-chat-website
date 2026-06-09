"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatMessages, type ChatMessage } from "@/components/chat-messages";
import { ChatInput } from "@/components/chat-input";
import { ErrorBoundary } from "@/components/error-boundary";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params?.id as string | undefined;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Track which conversation the currently-displayed messages belong to.
  const loadedConvRef = useRef<string | undefined>(undefined);

  // Load existing conversation
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      loadedConvRef.current = undefined;
      setLoading(false);
      return;
    }

    if (loadedConvRef.current === conversationId) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (!res.ok) {
          if (res.status === 404) {
            router.replace("/chat");
          }
          return;
        }
        const data = await res.json();
        if (!cancelled && data.messages) {
          setMessages(
            data.messages.map((m: any) => ({
              role: m.role,
              content: m.content,
            }))
          );
          loadedConvRef.current = conversationId;
        }
      } catch (err) {
        console.error("Failed to load conversation:", err);
        if (!cancelled) {
          setError("Failed to load conversation. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [conversationId, router]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      setError(null);

      // Add user message to UI immediately
      const userMsg: ChatMessage = { role: "user", content };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      // Add placeholder assistant message for streaming
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: "",
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversationId ?? undefined,
            message: content,
          }),
          signal: abort.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as any).error || `Server responded with ${res.status}`
          );
        }

        // Read SSE stream
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let newConvId: string | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);

              if (parsed.done) {
                newConvId = parsed.conversationId;
              } else if (parsed.delta) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  const last = updated[lastIdx];
                  if (last && last.role === "assistant") {
                    updated[lastIdx] = {
                      ...last,
                      content: last.content + parsed.delta,
                    };
                  }
                  return updated;
                });
              } else if (parsed.error) {
                setError(parsed.error);
              }
            } catch {
              // skip malformed JSON
            }
          }
        }

        // Mark streaming complete
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          const last = updated[lastIdx];
          if (last && last.role === "assistant") {
            updated[lastIdx] = { ...last, isStreaming: false };
          }
          return updated;
        });

        // Navigate to the new conversation if this was a fresh chat
        if (newConvId && !conversationId) {
          loadedConvRef.current = newConvId;
          router.replace(`/chat/${newConvId}`);
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Chat error:", err);
        setError(err.message || "Something went wrong");
        // Remove streaming placeholder on error
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.isStreaming) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [conversationId, router]
  );

  return (
    <ErrorBoundary>
      <ChatMessages
        messages={messages}
        error={error}
        loading={loading}
      />
      <ChatInput onSend={handleSend} isStreaming={isStreaming} />
    </ErrorBoundary>
  );
}

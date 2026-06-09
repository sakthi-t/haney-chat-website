"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { ConversationList } from "@/components/conversation-list";
import type { Conversation } from "@/lib/conversations";

interface SidebarClientProps {
  initialConversations: Conversation[];
}

export function SidebarClient({ initialConversations }: SidebarClientProps) {
  const params = useParams();
  const [conversations, setConversations] = useState<Conversation[]>(
    initialConversations
  );
  const lastFetchRef = useRef<string>("");

  // Keep in sync when server props change (full page load)
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  const activeId = (params?.id as string) ?? undefined;

  const handleRefresh = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        lastFetchRef.current = JSON.stringify(data);
      }
    } catch (err) {
      console.error("Failed to refresh conversations:", err);
    }
  }, []);

  // Auto-refresh when navigating to a conversation not yet in the list
  // (e.g., after creating a new chat via client-side navigation)
  useEffect(() => {
    if (!activeId) return;
    const exists = conversations.some((c) => c.id === activeId);
    if (!exists) {
      handleRefresh();
    }
  }, [activeId, conversations, handleRefresh]);

  return (
    <ConversationList
      conversations={conversations}
      activeId={activeId}
      onRefresh={handleRefresh}
    />
  );
}

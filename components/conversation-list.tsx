"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/conversations";

interface ConversationListProps {
  conversations: Conversation[];
  activeId?: string;
  onRefresh: () => void;
}

export function ConversationList({
  conversations,
  activeId,
  onRefresh,
}: ConversationListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleNewChat = useCallback(() => {
    router.push("/chat");
  }, [router]);

  const startRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const saveRename = async (id: string) => {
    if (!editTitle.trim()) return;
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      onRefresh();
    } catch (err) {
      console.error("Rename failed:", err);
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      onRefresh();
      if (activeId === id) {
        router.push("/chat");
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
    setDeletingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* New Chat button */}
      <div className="px-3 py-3">
        <button
          onClick={handleNewChat}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-sm text-zinc-300 hover:bg-white/10 transition-colors"
          )}
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-8 px-3">
            No conversations yet. Start a new chat!
          </p>
        )}

        {conversations.map((conv) => {
          const isActive =
            activeId === conv.id ||
            (pathname === "/chat" && activeId === conv.id);

          return (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors relative",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              )}
            >
              {editingId === conv.id ? (
                // ── Rename mode ──
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <MessageSquare size={14} className="shrink-0 text-zinc-500" />
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(conv.id);
                      if (e.key === "Escape") cancelRename();
                    }}
                    className="flex-1 min-w-0 bg-white/10 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => saveRename(conv.id)}
                    className="p-0.5 hover:text-emerald-400"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={cancelRename}
                    className="p-0.5 hover:text-red-400"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                // ── Normal mode ──
                <>
                  <Link
                    href={`/chat/${conv.id}`}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <MessageSquare size={14} className="shrink-0 text-zinc-500" />
                    <span className="truncate">{conv.title}</span>
                  </Link>

                  {/* Actions (visible on hover) */}
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startRename(conv);
                      }}
                      className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors"
                      title="Rename"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(conv.id);
                      }}
                      disabled={deletingId === conv.id}
                      className="p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === conv.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

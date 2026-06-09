"use client";

import { useState, useEffect, useCallback } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarClient } from "@/components/sidebar-client";
import type { Conversation } from "@/lib/conversations";

interface MobileSidebarProps {
  initialConversations: Conversation[];
  role: string;
}

export function MobileSidebar({
  initialConversations,
  role,
}: MobileSidebarProps) {
  const [open, setOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-zinc-900/80 border border-white/10 backdrop-blur-sm text-zinc-300 hover:text-white"
        aria-label="Open sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-zinc-950 border-r border-white/5 shadow-2xl transform transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
          <span className="font-semibold text-white text-sm">Haney Chat</span>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-hidden">
          <SidebarClient initialConversations={initialConversations} />
        </div>
      </aside>
    </>
  );
}

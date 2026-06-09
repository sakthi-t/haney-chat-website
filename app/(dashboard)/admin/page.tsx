"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Users,
  MessageSquare,
  MessagesSquare,
  UserPlus,
  Search,
  Trash2,
  Loader2,
  Shield,
  AlertTriangle,
  X,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminUser, AdminStats } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STAT_CARDS = [
  {
    key: "totalUsers",
    label: "Total Users",
    icon: Users,
    color: "from-violet-500 to-purple-600",
  },
  {
    key: "totalConversations",
    label: "Conversations",
    icon: MessageSquare,
    color: "from-cyan-500 to-blue-600",
  },
  {
    key: "totalMessages",
    label: "Messages",
    icon: MessagesSquare,
    color: "from-emerald-500 to-teal-600",
  },
  {
    key: "recentSignups",
    label: "New Users (7d)",
    icon: UserPlus,
    color: "from-amber-500 to-orange-600",
  },
] as const;

export default function AdminPage() {
  const { user: clerkUser } = useUser();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch stats ──
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users?stats=true");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch admin stats:", err);
    }
  }, []);

  // ── Fetch users ──
  const fetchUsers = useCallback(async (term?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/admin/users", window.location.origin);
      if (term) url.searchParams.set("search", term);
      const res = await fetch(url);
      if (res.status === 403) {
        setError("You do not have permission to access this page.");
        return;
      }
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      console.error("Failed to fetch users:", err);
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial load ──
  useEffect(() => {
    fetchStats();
    fetchUsers();
  }, [fetchStats, fetchUsers]);

  // ── Search with debounce ──
  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchUsers(value || undefined);
    }, 300);
  };

  // Cleanup search timer
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // ── Delete user ──
  const handleDelete = async (userId: string) => {
    setDeletingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      // Remove from list
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      // Refresh stats
      fetchStats();
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // ── Format date ──
  const formatDate = (d: Date | string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ── Role badge ──
  const roleBadge = (role: string) => {
    const isAdmin = role === "admin";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
          isAdmin
            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
        )}
      >
        {isAdmin && <Shield size={10} />}
        {role}
      </span>
    );
  };

  // ── Loading skeleton ──
  if (!clerkUser) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const currentClerkId = clerkUser.id;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">
              Admin Dashboard
            </h1>
            <p className="text-xs text-zinc-500">
              Manage users and monitor your deployment
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            fetchStats();
            fetchUsers(search || undefined);
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAT_CARDS.map((card) => {
            const Icon = card.icon;
            const value =
              stats?.[card.key as keyof AdminStats]?.toLocaleString() ?? "—";
            return (
              <div
                key={card.key}
                className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">{card.label}</p>
                    <p className="text-2xl font-bold text-white">{value}</p>
                  </div>
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center",
                      card.color
                    )}
                  >
                    <Icon size={18} className="text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400">
            <AlertTriangle size={18} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* User management */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <Input
                placeholder="Search users by email or username…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 text-white text-sm h-9"
              />
              {search && (
                <button
                  onClick={() => handleSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-600 ml-auto">
              {users.length} user{users.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users size={32} className="text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-500">
                {search ? "No users match your search." : "No users yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-xs font-medium text-zinc-500 px-5 py-3 w-12">
                      #
                    </th>
                    <th className="text-left text-xs font-medium text-zinc-500 px-5 py-3">
                      Email
                    </th>
                    <th className="text-left text-xs font-medium text-zinc-500 px-5 py-3">
                      Username
                    </th>
                    <th className="text-left text-xs font-medium text-zinc-500 px-5 py-3">
                      Role
                    </th>
                    <th className="text-left text-xs font-medium text-zinc-500 px-5 py-3">
                      Joined
                    </th>
                    <th className="text-right text-xs font-medium text-zinc-500 px-5 py-3 w-20">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, idx) => {
                    const isSelf = user.clerkUserId === currentClerkId;
                    const isConfirming = confirmDeleteId === user.id;
                    const isDeleting = deletingId === user.id;

                    return (
                      <tr
                        key={user.id}
                        className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-5 py-3 text-xs text-zinc-600">
                          {idx + 1}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-sm text-zinc-300 truncate max-w-[200px] block">
                            {user.email || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-sm text-zinc-400">
                            {user.username || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3">{roleBadge(user.role)}</td>
                        <td className="px-5 py-3 text-xs text-zinc-500">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {isConfirming ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleDelete(user.id)}
                                disabled={isDeleting}
                                className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                              >
                                {isDeleting ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  "Confirm"
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={isDeleting}
                                className="px-2 py-1 rounded text-xs text-zinc-500 hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                if (isSelf) {
                                  alert(
                                    "You cannot delete your own account."
                                  );
                                  return;
                                }
                                setConfirmDeleteId(user.id);
                              }}
                              disabled={isDeleting}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                isSelf
                                  ? "text-zinc-700 cursor-not-allowed"
                                  : "text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                              )}
                              title={
                                isSelf
                                  ? "Cannot delete yourself"
                                  : "Delete user"
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

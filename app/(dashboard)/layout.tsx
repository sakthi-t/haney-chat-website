import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { MessageSquare, Settings, Shield, Sparkles } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { SidebarClient } from "@/components/sidebar-client";
import { MobileSidebar } from "@/components/mobile-sidebar";

async function syncUser(
  clerkUserId: string,
  email: string | null,
  username: string | null,
  role: string | null
) {
  const finalRole = role === "admin" || role === "user" ? role : "user";

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkUserId, clerkUserId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.users).values({
      clerkUserId,
      email,
      username,
      role: finalRole,
    });
  } else {
    await db
      .update(schema.users)
      .set({
        email,
        username,
        role: finalRole,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.clerkUserId, clerkUserId));
  }

  return finalRole;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Fetch full user profile from Clerk and sync to Supabase
  let role = "user";
  let dbUserId: string | null = null;
  try {
    const user = await currentUser();
    if (user) {
      const primaryEmail = user.emailAddresses?.[0]?.emailAddress ?? null;
      const clerkRole = (user.privateMetadata?.role as string) ?? null;
      role = await syncUser(
        userId,
        primaryEmail,
        user.username ?? null,
        clerkRole
      );
    }
  } catch (err) {
    console.error("Failed to sync user:", err);
  }

  // Resolve internal user id for conversation queries
  try {
    const rows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.clerkUserId, userId))
      .limit(1);
    if (rows.length > 0) dbUserId = rows[0].id;
  } catch (err) {
    console.error("Failed to get user id:", err);
  }

  // Fetch conversations server-side
  let conversations: any[] = [];
  if (dbUserId) {
    try {
      conversations = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.userId, dbUserId))
        .orderBy(desc(schema.conversations.updatedAt));
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar — hidden below lg */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/5 bg-zinc-900/50 backdrop-blur-sm shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-white/5">
          <Link href="/chat" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-white">Haney Chat</span>
          </Link>
        </div>

        {/* Conversation list (client component with server data) */}
        <div className="flex-1 overflow-hidden">
          <SidebarClient initialConversations={conversations} />
        </div>

        {/* Bottom nav + user */}
        <div className="border-t border-white/5">
          <nav className="px-3 py-2 space-y-0.5">
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Settings size={18} />
              Settings
            </Link>
            {role === "admin" && (
              <Link
                href="/admin"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Shield size={18} />
                Admin
              </Link>
            )}
          </nav>

          <div className="px-3 py-3">
            <UserButton
              showName
              userProfileMode="modal"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  userButtonBox: "flex items-center gap-3 px-3 py-2 w-full",
                  userButtonOuterIdentifier:
                    "text-sm text-zinc-400 truncate",
                  userButtonTrigger:
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-lg",
                  avatarBox: "w-8 h-8 rounded-full",
                  popoverBox:
                    "rounded-xl border border-white/10 bg-zinc-900 shadow-xl backdrop-blur-md",
                },
              }}
              fallback={
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
                  <span className="text-sm text-zinc-500">Loading...</span>
                </div>
              }
            />
          </div>
        </div>
      </aside>

      {/* Mobile sidebar (hamburger) — visible only below lg */}
      <MobileSidebar
        initialConversations={conversations}
        role={role}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-zinc-950 w-full lg:w-auto">
        {children}
      </main>
    </div>
  );
}

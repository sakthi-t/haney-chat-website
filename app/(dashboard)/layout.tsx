import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { MessageSquare, Settings, Shield, Sparkles } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { SidebarClient } from "@/components/sidebar-client";
import { MobileSidebar } from "@/components/mobile-sidebar";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncUser(
  clerkUserId: string,
  email: string | null,
  username: string | null,
  role: string | null,
  attempt = 0
): Promise<string> {
  const finalRole = role === "admin" || role === "user" ? role : "user";

  try {
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
  } catch (err) {
    // Retry up to 2 more times with exponential backoff (1s, 2s)
    // Supabase free tier pauses after inactivity — first request wakes it
    if (attempt < 2) {
      console.warn(
        `syncUser failed (attempt ${attempt + 1}/3), retrying in ${Math.pow(2, attempt)}s...`,
        (err as Error).message
      );
      await delay(Math.pow(2, attempt) * 1000);
      return syncUser(clerkUserId, email, username, role, attempt + 1);
    }
    // All retries exhausted — log and return the best-guess role.
    // The user can still chat; the API route will upsert on first message.
    console.error("syncUser failed after 3 attempts:", (err as Error).message);
    return finalRole;
  }
}

async function getDbUserId(
  clerkUserId: string,
  attempt = 0
): Promise<string | null> {
  try {
    const rows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.clerkUserId, clerkUserId))
      .limit(1);
    return rows.length > 0 ? rows[0].id : null;
  } catch (err) {
    if (attempt < 2) {
      console.warn(
        `getDbUserId failed (attempt ${attempt + 1}/3), retrying...`,
        (err as Error).message
      );
      await delay(Math.pow(2, attempt) * 1000);
      return getDbUserId(clerkUserId, attempt + 1);
    }
    console.error("getDbUserId failed after 3 attempts:", (err as Error).message);
    return null;
  }
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

      // Resolve internal user id for conversation queries
      dbUserId = await getDbUserId(userId);
    }
  } catch (err) {
    // If Clerk API is unreachable (cold start / network), we still have
    // the auth session. Use a best-effort approach: the user can chat,
    // and user records are upserted inside API routes on first message.
    console.error("Failed to sync user:", err);

    // Try once more to get the DB user id (syncUser may have succeeded
    // even if currentUser failed on retry)
    try {
      dbUserId = await getDbUserId(userId);
    } catch {
      // Proceed without a DB user id — API routes handle upsert on write
    }
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

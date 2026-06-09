import { db, schema } from "@/lib/db";
import { eq, ilike, ne, and, sql, count, desc } from "drizzle-orm";

export type AdminUser = typeof schema.users.$inferSelect;

export interface AdminStats {
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  recentSignups: number; // last 7 days
}

/**
 * Fetch aggregate stats for the admin dashboard.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const [[userCount], [convCount], [msgCount], [recentCount]] =
    await Promise.all([
      db.select({ count: count() }).from(schema.users),
      db.select({ count: count() }).from(schema.conversations),
      db.select({ count: count() }).from(schema.messages),
      db
        .select({ count: count() })
        .from(schema.users)
        .where(
          sql`${schema.users.createdAt} > now() - interval '7 days'`
        ),
    ]);

  return {
    totalUsers: userCount?.count ?? 0,
    totalConversations: convCount?.count ?? 0,
    totalMessages: msgCount?.count ?? 0,
    recentSignups: recentCount?.count ?? 0,
  };
}

/**
 * List users with optional search (matches email or username).
 * Returns all users sorted by creation date newest first.
 */
export async function getUsers(
  search?: string,
  limit = 50,
  offset = 0
): Promise<AdminUser[]> {
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    return db
      .select()
      .from(schema.users)
      .where(
        sql`(${schema.users.email} ilike ${term} or ${schema.users.username} ilike ${term})`
      )
      .orderBy(desc(schema.users.createdAt))
      .limit(limit)
      .offset(offset);
  }

  return db
    .select()
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get a single user by internal UUID.
 */
export async function getUserById(
  id: string
): Promise<AdminUser | undefined> {
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return rows[0];
}

/**
 * Delete a user by internal UUID.  Also deletes the user from Clerk.
 * Returns { ok: boolean, clerkUserId: string | null } so the caller
 * can decide whether Clerk cleanup is needed.
 *
 * Caller must verify the admin is not deleting themselves.
 */
export async function deleteUserById(
  id: string
): Promise<{ ok: boolean; clerkUserId: string | null }> {
  // Fetch the Clerk user ID BEFORE deleting so we can clean up Clerk
  const rows = await db
    .select({ clerkUserId: schema.users.clerkUserId })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);

  const clerkUserId = rows[0]?.clerkUserId ?? null;

  const result = await db
    .delete(schema.users)
    .where(eq(schema.users.id, id));

  return { ok: result.count > 0, clerkUserId };
}

/**
 * Delete a user from Clerk's Backend API.
 * Uses CLERK_SECRET_KEY for server-side authentication.
 */
export async function deleteClerkUser(
  clerkUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error("CLERK_SECRET_KEY is not set");
    return { ok: false, error: "Server configuration error" };
  }

  try {
    const res = await fetch(
      `https://api.clerk.com/v1/users/${clerkUserId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg =
        (body as { errors?: { message?: string }[] })?.errors?.[0]
          ?.message ?? `Clerk returned ${res.status}`;
      console.error("Clerk delete error:", msg);
      return { ok: false, error: msg };
    }

    return { ok: true };
  } catch (err) {
    console.error("Clerk delete fetch error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

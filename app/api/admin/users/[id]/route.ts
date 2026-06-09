import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { deleteUserById, deleteClerkUser } from "@/lib/admin";
import { uuidParamSchema } from "@/lib/validations";
import { ADMIN_RATE_LIMIT, rateLimitResponse } from "@/lib/rate-limit";

/**
 * DELETE /api/admin/users/[id]
 *
 * Delete a user by internal UUID.
 * Deletes the user from both Supabase and Clerk.
 * Admin-only.  Cannot delete yourself.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const limitRes = rateLimitResponse({
    ...ADMIN_RATE_LIMIT,
    identifier: `admin:${clerkUserId}`,
  });
  if (limitRes) return limitRes;

  // Verify admin role
  const clerkUser = await currentUser();
  const role = (clerkUser?.privateMetadata?.role as string) ?? "user";
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse & validate ID
  const { id } = await params;
  const parsedId = uuidParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  // Prevent self-deletion
  const adminRow = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.clerkUserId, clerkUserId))
    .limit(1);

  if (adminRow.length > 0 && adminRow[0].id === parsedId.data) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }

  try {
    // Delete from Supabase first (gets clerkUserId back)
    const result = await deleteUserById(parsedId.data);
    if (!result.ok) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Clean up from Clerk
    if (result.clerkUserId) {
      const clerkResult = await deleteClerkUser(result.clerkUserId);
      if (!clerkResult.ok) {
        console.error(
          `Failed to delete Clerk user ${result.clerkUserId}: ${clerkResult.error}`
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin delete user error:", err);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}

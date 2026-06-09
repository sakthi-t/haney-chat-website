import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getUsers, getAdminStats } from "@/lib/admin";
import { adminUsersQuerySchema } from "@/lib/validations";
import { ADMIN_RATE_LIMIT, rateLimitResponse } from "@/lib/rate-limit";

/**
 * GET /api/admin/users
 *
 * Query params:
 *   ?search=<term>   — filter by email or username
 *   ?limit=<n>        — page size (default 50)
 *   ?offset=<n>       — pagination offset (default 0)
 *   ?stats=true       — return aggregated stats instead of user list
 *
 * Admin-only.  Verifies role from Clerk private_metadata.
 */
export async function GET(req: NextRequest) {
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
  const user = await currentUser();
  const role = (user?.privateMetadata?.role as string) ?? "user";
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  // Parse query params
  const queryRaw = Object.fromEntries(searchParams.entries());
  const parsed = adminUsersQuerySchema.safeParse(queryRaw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }
  const { search, limit, offset, stats } = parsed.data;

  // Stats mode
  if (stats) {
    try {
      const data = await getAdminStats();
      return NextResponse.json(data);
    } catch (err) {
      console.error("Admin stats error:", err);
      return NextResponse.json(
        { error: "Failed to fetch stats" },
        { status: 500 }
      );
    }
  }

  // User list mode (limit & offset already constrained by Zod)
  try {
    const users = await getUsers(search, limit, offset);
    return NextResponse.json(users);
  } catch (err) {
    console.error("Admin users error:", err);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

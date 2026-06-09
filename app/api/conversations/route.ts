import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  getConversations,
  createConversation,
} from "@/lib/conversations";
import { CONVERSATIONS_RATE_LIMIT, rateLimitResponse } from "@/lib/rate-limit";

/**
 * GET /api/conversations — list conversations for the current user.
 */
export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const limitRes = rateLimitResponse({
    ...CONVERSATIONS_RATE_LIMIT,
    identifier: `conv:${clerkUserId}`,
  });
  if (limitRes) return limitRes;

  const userRows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.clerkUserId, clerkUserId))
    .limit(1);

  if (userRows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const conversations = await getConversations(userRows[0].id);
  return NextResponse.json(conversations, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

/**
 * POST /api/conversations — create a new conversation.
 */
export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const limitRes = rateLimitResponse({
    ...CONVERSATIONS_RATE_LIMIT,
    identifier: `conv:${clerkUserId}`,
  });
  if (limitRes) return limitRes;

  const userRows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.clerkUserId, clerkUserId))
    .limit(1);

  if (userRows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const conversation = await createConversation(userRows[0].id);
  return NextResponse.json(conversation, { status: 201 });
}

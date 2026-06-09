import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  getConversation,
  getMessages,
  updateConversationTitle,
  deleteConversation,
} from "@/lib/conversations";
import { renameConversationSchema, uuidParamSchema } from "@/lib/validations";
import { CONVERSATIONS_RATE_LIMIT, rateLimitResponse } from "@/lib/rate-limit";

async function getUserId(): Promise<string | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.clerkUserId, clerkUserId))
    .limit(1);

  return rows[0]?.id ?? null;
}

async function checkRateLimit(clerkUserId: string): Promise<Response | null> {
  return rateLimitResponse({
    ...CONVERSATIONS_RATE_LIMIT,
    identifier: `conv:${clerkUserId}`,
  });
}

/**
 * GET /api/conversations/[id] — get conversation with messages.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsedId = uuidParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const conversation = await getConversation(parsedId.data, userId);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await getMessages(parsedId.data);
  return NextResponse.json(
    { ...conversation, messages },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

/**
 * PATCH /api/conversations/[id] — rename conversation.
 * Body: { title: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsedId = uuidParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = renameConversationSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }

  const updated = await updateConversationTitle(
    parsedId.data,
    userId,
    parsed.data.title
  );
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

/**
 * DELETE /api/conversations/[id] — delete conversation.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsedId = uuidParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const deleted = await deleteConversation(parsedId.data, userId);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

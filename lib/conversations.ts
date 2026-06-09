import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export type Conversation = typeof schema.conversations.$inferSelect;
export type Message = typeof schema.messages.$inferSelect;

// ── Conversations ──

export async function getConversations(
  userId: string
): Promise<Conversation[]> {
  return db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.userId, userId))
    .orderBy(desc(schema.conversations.updatedAt));
}

export async function getConversation(
  id: string,
  userId: string
): Promise<Conversation | undefined> {
  const rows = await db
    .select()
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, id),
        eq(schema.conversations.userId, userId)
      )
    )
    .limit(1);
  return rows[0];
}

export async function createConversation(
  userId: string,
  title = "New Chat"
): Promise<Conversation> {
  const rows = await db
    .insert(schema.conversations)
    .values({ userId, title })
    .returning();
  return rows[0];
}

export async function updateConversationTitle(
  id: string,
  userId: string,
  title: string
): Promise<Conversation | undefined> {
  const rows = await db
    .update(schema.conversations)
    .set({ title, updatedAt: new Date() })
    .where(
      and(
        eq(schema.conversations.id, id),
        eq(schema.conversations.userId, userId)
      )
    )
    .returning();
  return rows[0];
}

export async function deleteConversation(
  id: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, id),
        eq(schema.conversations.userId, userId)
      )
    );
  return result.count > 0;
}

export async function touchConversation(id: string, userId: string) {
  await db
    .update(schema.conversations)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(schema.conversations.id, id),
        eq(schema.conversations.userId, userId)
      )
    );
}

// ── Messages ──

export async function getMessages(
  conversationId: string
): Promise<Message[]> {
  return db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(schema.messages.createdAt);
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  tokenCount?: number
): Promise<Message> {
  const rows = await db
    .insert(schema.messages)
    .values({
      conversationId,
      role,
      content,
      tokenCount: tokenCount != null ? String(tokenCount) : null,
    })
    .returning();
  return rows[0];
}

/**
 * Auto-title: use the first user message (first 50 chars) as the title.
 */
export async function autoTitleConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  const msgs = await getMessages(conversationId);
  const firstUserMsg = msgs.find((m) => m.role === "user");
  if (!firstUserMsg) return;

  const title =
    firstUserMsg.content.slice(0, 50) +
    (firstUserMsg.content.length > 50 ? "…" : "");

  await updateConversationTitle(conversationId, userId, title);
}

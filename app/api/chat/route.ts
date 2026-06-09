import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { HaneyChatModel, stripSpecialTokens } from "@/lib/model";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import {
  getMessages,
  addMessage,
  createConversation,
  touchConversation,
  autoTitleConversation,
} from "@/lib/conversations";
import { chatRequestSchema } from "@/lib/validations";
import { CHAT_RATE_LIMIT, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/chat
 *
 * Body: { conversationId?: string; message: string }
 *
 * - Verifies Clerk session
 * - Loads conversation history (or creates new conversation)
 * - Calls Haney Chat via LangChain streaming
 * - Saves user + assistant messages
 * - Returns SSE stream token-by-token
 */
export async function POST(req: NextRequest) {
  // ── Auth ──
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // ── Rate limit ──
  const limitRes = rateLimitResponse({
    ...CHAT_RATE_LIMIT,
    identifier: `chat:${clerkUserId}`,
  });
  if (limitRes) return limitRes;

  // ── Resolve internal user id ──
  const userRows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.clerkUserId, clerkUserId))
    .limit(1);

  if (userRows.length === 0) {
    return new Response("User not found", { status: 404 });
  }
  const userId = userRows[0].id;

  // ── Parse & validate body ──
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { conversationId, message } = parsed.data;

  // ── Create or verify conversation ──
  let convId = conversationId;
  let isNew = false;

  if (convId) {
    const conv = await db
      .select({ id: schema.conversations.id })
      .from(schema.conversations)
      .where(eq(schema.conversations.id, convId))
      .limit(1);

    if (conv.length === 0) {
      convId = undefined;
    }
  }

  if (!convId) {
    const conv = await createConversation(userId);
    convId = conv.id;
    isNew = true;
  }

  // ── Save user message ──
  await addMessage(convId, "user", message);

  // ── Auto-title or touch ──
  if (isNew) {
    await autoTitleConversation(convId, userId);
  } else {
    await touchConversation(convId, userId);
  }

  // ── Build message history ──
  const history = await getMessages(convId);
  const langchainMessages: BaseMessage[] = history.map((m) =>
    m.role === "user"
      ? new HumanMessage(stripSpecialTokens(m.content))
      : new AIMessage(stripSpecialTokens(m.content))
  );

  // ── Prompt logging ──
  const totalChars = langchainMessages.reduce(
    (sum, m) => sum + (m.content as string).length, 0
  );
  console.log(
    `[api/chat] prompt — ${langchainMessages.length} messages, ${totalChars} chars, ~${Math.round(totalChars / 4)} tokens`
  );
  if (langchainMessages.length > 0) {
    const last5 = langchainMessages.slice(-5);
    console.log("[api/chat] last 5 history messages:");
    last5.forEach((m, i) => {
      const preview =
        (m.content as string).length > 200
          ? (m.content as string).slice(0, 200) + "..."
          : (m.content as string);
      console.log(
        `  [${i + 1}] ${m._getType()}: ${preview}`
      );
    });
  }

  // ── SSE stream ──
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullResponse = "";

      // Heartbeat keeps Netlify's gateway alive during Modal cold starts
      // (container spin-up + model loading can take 60-120s with zero bytes
      // flowing, which triggers Netlify's 60s idle timeout → 504).
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 10_000);

      try {
        console.log("[api/chat] request received — calling model");
        console.time("[api/chat] model-stream");

        const model = new HaneyChatModel({});

        const chunks = model._streamResponseChunks(
          langchainMessages,
          {} as any,
          undefined
        );

        for await (const chunk of chunks) {
          const delta = chunk.text;
          fullResponse += delta;

          const sse = `data: ${JSON.stringify({ delta })}\n\n`;
          controller.enqueue(encoder.encode(sse));
        }

        console.timeEnd("[api/chat] model-stream");
        console.log(
          `[api/chat] response completed — ${fullResponse.length} chars`
        );

        // Save assistant message BEFORE sending "done" — strip tokens
        const cleanedResponse = stripSpecialTokens(fullResponse);
        await addMessage(convId, "assistant", cleanedResponse);
        await touchConversation(convId, userId);

        if (fullResponse.length === 0) {
          const errSse = `data: ${JSON.stringify({ error: "Model returned an empty response. Please try again." })}\n\n`;
          controller.enqueue(encoder.encode(errSse));
        }

        const done = `data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`;
        controller.enqueue(encoder.encode(done));
      } catch (err: any) {
        console.error(`[api/chat] error: ${err.message}`);
        const errorSse = `data: ${JSON.stringify({ error: err.message })}\n\n`;
        controller.enqueue(encoder.encode(errorSse));
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
      "X-Conversation-Id": convId,
    },
  });
}

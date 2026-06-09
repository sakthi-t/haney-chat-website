import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Invalid signature", { status: 401 });
  }

  const { type, data } = evt;

  try {
    switch (type) {
      case "user.created": {
        const { id, email_addresses, username } = data;
        const primaryEmail = email_addresses?.[0]?.email_address;

        await db.insert(schema.users).values({
          clerkUserId: id,
          email: primaryEmail ?? null,
          username: username ?? null,
          role: (data as any).private_metadata?.role ?? "user",
        });
        break;
      }

      case "user.updated": {
        const { id, email_addresses, username } = data;
        const primaryEmail = email_addresses?.[0]?.email_address;

        await db
          .update(schema.users)
          .set({
            email: primaryEmail ?? null,
            username: username ?? null,
            role: (data as any).private_metadata?.role ?? "user",
            updatedAt: new Date(),
          })
          .where(eq(schema.users.clerkUserId, id));
        break;
      }

      case "user.deleted": {
        const { id } = data;
        if (id) {
          await db
            .delete(schema.users)
            .where(eq(schema.users.clerkUserId, id));
        }
        break;
      }

      default:
        console.log(`Unhandled webhook event type: ${type}`);
    }
  } catch (err) {
    console.error(`Webhook handler error for ${type}:`, err);
    return new Response("Internal error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

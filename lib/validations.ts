import { z } from "zod";

// ── Chat ────────────────────────────────────────────────────────────

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(8000, "Message exceeds 8000 character limit")
    .transform((s) => s.trim()),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

// ── Conversations ───────────────────────────────────────────────────

export const renameConversationSchema = z.object({
  title: z
    .string()
    .min(1, "Title cannot be empty")
    .max(200, "Title exceeds 200 character limit")
    .transform((s) => s.trim()),
});

export type RenameConversation = z.infer<typeof renameConversationSchema>;

// ── Admin ────────────────────────────────────────────────────────────

export const adminUsersQuerySchema = z.object({
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  stats: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

// ── UUID param ───────────────────────────────────────────────────────

export const uuidParamSchema = z.string().uuid("Invalid ID format");

// ── General helpers ──────────────────────────────────────────────────

/** Strip HTML tags from user input (defense in depth) */
export function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

/** Escape special regex characters */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

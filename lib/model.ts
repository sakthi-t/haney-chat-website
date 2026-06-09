import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatResult, ChatGenerationChunk } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

const MODEL_API = process.env.MODEL_API!;

interface ModalChatChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason?: string | null;
}

interface ModalChatResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: ModalChatChoice[];
}

// ── Special token stripping ────────────────────────────────────────────
// Chat-template models (537M class) often emit literal tokens like
// <|assistant|>, <|im_start|>, <s>, [/INST] etc. If these are saved to
// the DB and fed back into the next turn's conversation, they compound
// and cause the model to drift / break.  This function strips them from
// both input (before sending) and output (before saving).
//
// Patterns are ordered: complete tokens first, then fragments (missing
// opening <| or closing |>), then partial catch-all.
const SPECIAL_TOKENS: { pattern: RegExp; label: string }[] = [
  // ── Complete ChatML tokens ──
  { pattern: /<\|im_start\|>/gi, label: "<|im_start|>" },
  { pattern: /<\|im_end\|>/gi, label: "<|im_end|>" },
  { pattern: /<\|assistant\|>/gi, label: "<|assistant|>" },
  { pattern: /<\|user\|>/gi, label: "<|user|>" },
  { pattern: /<\|system\|>/gi, label: "<|system|>" },
  { pattern: /<\|endoftext\|>/gi, label: "<|endoftext|>" },
  // ── Complete Llama tokens ──
  { pattern: /\[INST\]/gi, label: "[INST]" },
  { pattern: /\[\/INST\]/gi, label: "[/INST]" },
  { pattern: /<<SYS>>/gi, label: "<<SYS>>" },
  { pattern: /<<\/SYS>>/gi, label: "<</SYS>>" },
  { pattern: /<\/s>/gi, label: "</s>" },
  { pattern: /<s>/gi, label: "<s>" },
  // ── Complete Gemma tokens ──
  { pattern: /<bos>/gi, label: "<bos>" },
  { pattern: /<eos>/gi, label: "<eos>" },
  { pattern: /<start_of_turn>/gi, label: "<start_of_turn>" },
  { pattern: /<end_of_turn>/gi, label: "<end_of_turn>" },
  // ── Complete Anthropic tokens ──
  { pattern: /<\|Human:\|>/gi, label: "<|Human:|>" },
  { pattern: /<\|Assistant:\|>/gi, label: "<|Assistant:|>" },
  // ── Fragments: missing opening <| ──
  { pattern: /\bassistant\|>/gi, label: "assistant|> (fragment)" },
  { pattern: /\buser\|>/gi, label: "user|> (fragment)" },
  { pattern: /\bsystem\|>/gi, label: "system|> (fragment)" },
  { pattern: /\bim_start\|>/gi, label: "im_start|> (fragment)" },
  { pattern: /\bim_end\|>/gi, label: "im_end|> (fragment)" },
  { pattern: /\bendoftext\|>/gi, label: "endoftext|> (fragment)" },
  // ── Fragments: missing closing |> ──
  { pattern: /<\|assistant\b/gi, label: "<|assistant (fragment)" },
  { pattern: /<\|user\b/gi, label: "<|user (fragment)" },
  { pattern: /<\|system\b/gi, label: "<|system (fragment)" },
  { pattern: /<\|im_start\b/gi, label: "<|im_start (fragment)" },
  { pattern: /<\|im_end\b/gi, label: "<|im_end (fragment)" },
  // ── Fragments: pipe-only (no angle brackets) ──
  { pattern: /\|assistant\|>/gi, label: "|assistant|> (pipe fragment)" },
  { pattern: /\|user\|>/gi, label: "|user|> (pipe fragment)" },
  { pattern: /\|system\|>/gi, label: "|system|> (pipe fragment)" },
  // ── Partial / corrupted ──
  { pattern: /\bistant\|>/gi, label: "istant|> (partial)" },
  // ── Generic catch-all (must be last) ──
  { pattern: /<\|.*?\|>/gi, label: "<|...|> (generic)" },
];

const SYSTEM_PROMPT =
  "You are Haney Chat, a helpful AI assistant. " +
  "Answer clearly and concisely. Stay on topic. " +
  "Do not repeat special tokens or formatting delimiters.";

export function stripSpecialTokens(text: string): string {
  let cleaned = text;
  const removed: string[] = [];

  for (const { pattern, label } of SPECIAL_TOKENS) {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, "");
    if (cleaned !== before) {
      // Count roughly how many instances were removed
      const matchCount = before.match(new RegExp(pattern.source, "gi"))?.length ?? 1;
      removed.push(`${label} x${matchCount}`);
    }
  }

  if (removed.length > 0) {
    console.log(`[model] stripSpecialTokens removed: ${removed.join(", ")}`);
  }

  // Normalise whitespace that may have been left behind
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

function convertLangChainMessageToModal(
  msg: BaseMessage
): { role: string; content: string } {
  const content = stripSpecialTokens(msg.content as string);

  if (msg instanceof HumanMessage) {
    return { role: "user", content };
  }
  if (msg instanceof AIMessage) {
    return { role: "assistant", content };
  }
  if (msg instanceof SystemMessage) {
    return { role: "system", content };
  }
  // Fallback — treat _getType() as role
  const role = msg._getType?.() ?? "user";
  return { role: role === "ai" ? "assistant" : role, content };
}

/**
 * Build the full prompt array for a request — prepends system prompt
 * and sanitises every message.  Also logs prompt details for debugging.
 */
function buildPrompt(messages: BaseMessage[]): { role: string; content: string }[] {
  const all: BaseMessage[] = [
    new SystemMessage(SYSTEM_PROMPT),
    ...messages,
  ];

  const prompt = all.map(convertLangChainMessageToModal);

  // ── Sliding window: keep newest messages, drop oldest ──
  // Modal truncates prompt to 1000 chars. We budget 850 for content,
  // leaving ~150 for JSON overhead (keys, quotes, braces, field names).
  const MAX_CONTENT_CHARS = 850;
  let totalChars = prompt.reduce((sum, m) => sum + m.content.length, 0);
  let dropped = 0;

  // Always keep the system message (index 0) and the last 2 non-system
  // messages so the newest user→assistant exchange is always preserved.
  while (totalChars > MAX_CONTENT_CHARS && prompt.length > 3) {
    // Remove the oldest non-system message (index 1 — right after system)
    const removed = prompt.splice(1, 1)[0]!;
    totalChars -= removed.content.length;
    dropped++;
  }

  if (dropped > 0) {
    console.log(
      `[model] prompt truncated — dropped ${dropped} oldest message(s), ` +
      `${prompt.length} remaining, ${totalChars} chars (budget: ${MAX_CONTENT_CHARS})`
    );
  }

  // ── Logging ──
  console.log(
    `[model] prompt — ${prompt.length} messages, ${totalChars} chars, ~${Math.round(totalChars / 4)} tokens`
  );
  console.log("[model] === FINAL PROMPT ARRAY (SENT TO MODAL) ===");
  prompt.forEach((m, i) => {
    console.log(`[${i}] ${m.role}: ${m.content}`);
  });
  console.log("[model] === END FINAL PROMPT ===");

  return prompt;
}

/**
 * HaneyChatModel — custom LangChain Chat Model adapter for the Haney Chat
 * Modal inference endpoint (OpenAI-compatible request/response format).
 */
export class HaneyChatModel extends BaseChatModel {
  // ── required BaseChatModel fields ──
  _llmType(): string {
    return "haney-chat";
  }

  lc_namespace = ["haney", "chat"];

  // ── the actual LLM call ──
  async _generate(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const body = {
      model: "haney-chat",
      messages: buildPrompt(messages),
    };

    const response = await fetch(MODEL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Haney Chat API returned ${response.status}: ${errText}`
      );
    }

    const data: ModalChatResponse = await response.json();

    const rawContent = data.choices?.[0]?.message?.content ?? "";
    const content = stripSpecialTokens(rawContent);
    const message = new AIMessage(content);

    return {
      generations: [{ text: content, message }],
    };
  }

  /**
   * Streaming implementation — reads the response from Modal and yields
   * AIMessageChunks.
   *
   * Detects whether the Modal endpoint returns SSE (data: lines) or plain
   * JSON (it ignores stream:true).  Either way we produce chunks.
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const body = {
      model: "haney-chat",
      messages: buildPrompt(messages),
      stream: true,
    };

    // 5-minute timeout — Modal cold starts (container spin-up + model
    // loading) can take 2-5 minutes on first request after idle.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300_000);

    // ── Fix 2: Log exact request body ──
    console.log("[model] === FULL REQUEST BODY ===");
    console.log(JSON.stringify(body, null, 2));
    console.log("[model] === END REQUEST BODY ===");

    console.log("[model] sending request to MODEL_API");
    console.time("[model] modal-fetch");

    let response: Response;
    try {
      response = await fetch(MODEL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeout);
      console.timeEnd("[model] modal-fetch");
      if (err.name === "AbortError") {
        console.error("[model] timeout — request aborted after 300s");
        throw new Error(
          "Request timed out after 5 minutes. The model is still loading " +
          "on Modal (cold start). Please try again in a moment — the " +
          "container will be warm and respond faster."
        );
      }
      console.error(`[model] fetch error: ${err.message}`);
      throw err;
    }
    clearTimeout(timeout);
    console.timeEnd("[model] modal-fetch");
    console.log("[model] first byte received (response headers)");

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Haney Chat API returned ${response.status}: ${errText.slice(0, 200)}`
      );
    }

    // Read the entire body as text
    console.time("[model] read-body");
    const raw = await response.text();
    console.timeEnd("[model] read-body");
    console.log(
      `[model] response body received — ${raw.length} raw bytes`
    );

    // ── Fix 2: Log raw response ──
    console.log("[model] === RAW RESPONSE FROM MODAL ===");
    console.log(raw.length > 3000 ? raw.slice(0, 3000) + "..." : raw);
    console.log("[model] === END RAW RESPONSE ===");

    // Detect format: SSE starts with "data:", plain JSON starts with "{"
    if (raw.trim().startsWith("{")) {
      // ── Plain JSON (Modal ignores stream:true) ──
      try {
        const data: ModalChatResponse = JSON.parse(raw);
        const rawContent = data.choices?.[0]?.message?.content ?? "";

        // ── Fix 2: Log before/after strip ──
        console.log("[model] === PARSED CONTENT (BEFORE STRIP) ===");
        console.log(`[model] rawContent.length = ${rawContent.length}`);
        console.log(rawContent);
        console.log("[model] === END PARSED CONTENT ===");

        const content = stripSpecialTokens(rawContent);

        console.log("[model] === PARSED CONTENT (AFTER STRIP) ===");
        console.log(`[model] content.length after strip = ${content.length}`);
        console.log(content);
        console.log("[model] === END STRIPPED CONTENT ===");
        if (content) {
          // Yield word-by-word instead of character-by-character.
          // No artificial delay — yields as fast as the consumer
          // reads, avoiding background-tab setTimeout throttling
          // (browsers clamp sub-second timers to 1000ms in
          // background tabs, which would stall 2000+ chars for
          // 8+ minutes and freeze the UI).
          const words = content.split(/(\s+)/);
          const nonEmpty = words.filter(Boolean);
          console.log(
            `[model] response parsed — ${content.length} chars, ${nonEmpty.length} words, about to yield ${nonEmpty.length} chunks`
          );
          let chunkIndex = 0;
          for (const word of words) {
            if (!word) continue;
            chunkIndex++;
            console.log(
              `[model] yielding chunk #${chunkIndex}/${nonEmpty.length}: "${word.slice(0, 80)}"...`
            );
            yield new ChatGenerationChunk({
              text: word,
              message: new AIMessageChunk(word),
            });
          }
          console.log(`[model] yielded ${chunkIndex} chunks total`);
        } else {
          console.log(
            `[model] WARNING — content empty after strip (rawContent had ${rawContent.length} chars) — zero chunks yielded`
          );
        }
      } catch {
        // ignore parse errors — no chunks yielded
      }
      return;
    }

    // ── True SSE stream ──
    const lines = raw.split("\n");

    console.log(`[model] SSE stream — ${lines.length} raw lines`);
    let sseChunkIndex = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr === "[DONE]") break;

      try {
        const chunk = JSON.parse(jsonStr) as ModalChatResponse;
        const choice = chunk.choices?.[0];
        const rawDelta =
          (choice as any)?.delta?.content ??
          choice?.message?.content ??
          "";
        const delta = stripSpecialTokens(rawDelta);
        if (rawDelta && !delta) {
          console.log(
            `[model] SSE chunk — rawDelta ${rawDelta.length} chars → EMPTY after strip`
          );
        }
        if (!delta) continue;

        sseChunkIndex++;
        console.log(
          `[model] yielding SSE chunk #${sseChunkIndex}: "${delta.slice(0, 80)}"`
        );
        yield new ChatGenerationChunk({
          text: delta,
          message: new AIMessageChunk(delta),
        });
      } catch {
        // skip malformed JSON lines
      }
    }
    console.log(`[model] yielded ${sseChunkIndex} SSE chunks total`);
  }
}

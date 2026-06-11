import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatResult, ChatGenerationChunk } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

const MODEL_API = process.env.MODEL_API!;
const MODEL_MAX_TOKENS = parseInt(process.env.MODEL_MAX_TOKENS ?? "256", 10);

// ── Response format for v2 endpoint ────────────────────────────────────
// POST { prompt: string, max_tokens: number }
// Response: { response: string }

interface ModalGenerateResponse {
  response: string;
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

/**
 * Format a single message into a role-prefixed line for the prompt string.
 */
function formatMessageForPrompt(msg: BaseMessage): string {
  const content = stripSpecialTokens(msg.content as string);

  if (msg instanceof SystemMessage) {
    return `System: ${content}`;
  }
  if (msg instanceof HumanMessage) {
    return `User: ${content}`;
  }
  if (msg instanceof AIMessage) {
    return `Assistant: ${content}`;
  }
  // Fallback
  const type = msg._getType?.();
  if (type === "system") return `System: ${content}`;
  if (type === "ai") return `Assistant: ${content}`;
  return `User: ${content}`;
}

/**
 * Build the full prompt string for a request.
 *
 * Formats the conversation as:
 *   System: ...
 *   User: ...
 *   Assistant: ...
 *   User: ...
 *   Assistant:    <-- model should complete this
 *
 * Uses a sliding window to keep the prompt within reasonable bounds.
 */
function buildPrompt(messages: BaseMessage[]): string {
  const systemLine = `System: ${SYSTEM_PROMPT}`;
  const allMessages = messages.map(formatMessageForPrompt);

  // ── Sliding window: drop oldest non-system messages if too long ──
  // Appending "Assistant:" at the end signals the model to respond.
  const PROMPT_SUFFIX = "\nAssistant:";
  const MAX_PROMPT_CHARS = 1500;

  // Build progressively and truncate from the top if needed
  let body = allMessages.join("\n\n");
  let total = systemLine.length + body.length + PROMPT_SUFFIX.length;

  let dropped = 0;
  // Drop oldest messages one by one until we fit (keep at least last 2)
  while (total > MAX_PROMPT_CHARS && allMessages.length > 2) {
    const removed = allMessages.shift()!;
    body = allMessages.join("\n\n");
    total = systemLine.length + body.length + PROMPT_SUFFIX.length;
    dropped++;
  }

  const prompt = `${systemLine}\n\n${body}${PROMPT_SUFFIX}`;

  if (dropped > 0) {
    console.log(
      `[model] prompt truncated — dropped ${dropped} oldest message(s), ` +
      `${allMessages.length} messages remaining, ${prompt.length} chars (budget: ${MAX_PROMPT_CHARS})`
    );
  }

  // ── Logging ──
  console.log(
    `[model] prompt — ${allMessages.length + 1} entries (system + ${allMessages.length} messages), ${prompt.length} chars, ~${Math.round(prompt.length / 4)} tokens`
  );
  console.log("[model] === FINAL PROMPT (SENT TO MODAL) ===");
  console.log(prompt.length > 2000 ? prompt.slice(0, 2000) + "..." : prompt);
  console.log("[model] === END FINAL PROMPT ===");

  return prompt;
}

/**
 * HaneyChatModel — custom LangChain Chat Model adapter for the Haney Chat
 * Modal inference endpoint (v2 — prompt/max_tokens format).
 */
export class HaneyChatModel extends BaseChatModel {
  // ── required BaseChatModel fields ──
  _llmType(): string {
    return "haney-chat";
  }

  lc_namespace = ["haney", "chat"];

  // ── the actual LLM call (non-streaming) ──
  async _generate(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const body = {
      prompt: buildPrompt(messages),
      max_tokens: MODEL_MAX_TOKENS,
    };

    console.log("[model] === FULL REQUEST BODY ===");
    console.log(JSON.stringify({ ...body, prompt: body.prompt.slice(0, 200) + "..." }, null, 2));
    console.log("[model] === END REQUEST BODY ===");

    const response = await fetch(MODEL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Haney Chat API returned ${response.status}: ${errText.slice(0, 500)}`
      );
    }

    const data: ModalGenerateResponse = await response.json();

    const rawContent = data.response ?? "";
    const content = stripSpecialTokens(rawContent);
    const message = new AIMessage(content);

    return {
      generations: [{ text: content, message }],
    };
  }

  /**
   * Streaming implementation — calls the v2 endpoint (non-streaming) and
   * simulates token-by-token output by yielding words.
   *
   * The v2 endpoint returns plain JSON { response: "..." }.
   * We yield word-by-word so the frontend still gets progressive rendering.
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const body = {
      prompt: buildPrompt(messages),
      max_tokens: MODEL_MAX_TOKENS,
    };

    // 5-minute timeout — Modal cold starts (container spin-up + model
    // loading) can take 2-5 minutes on first request after idle.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300_000);

    console.log("[model] === FULL REQUEST BODY ===");
    console.log(JSON.stringify(
      { ...body, prompt: body.prompt.length > 300 ? body.prompt.slice(0, 300) + "..." : body.prompt },
      null, 2
    ));
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
    console.log("[model] response received");

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Haney Chat API returned ${response.status}: ${errText.slice(0, 500)}`
      );
    }

    // Read the entire response body
    const raw = await response.text();
    console.log(
      `[model] response body — ${raw.length} raw bytes`
    );
    console.log("[model] === RAW RESPONSE ===");
    console.log(raw.length > 2000 ? raw.slice(0, 2000) + "..." : raw);
    console.log("[model] === END RAW RESPONSE ===");

    // Parse JSON response
    let data: ModalGenerateResponse;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error("[model] failed to parse response JSON");
      return;
    }

    const rawContent = data.response ?? "";

    console.log("[model] === PARSED CONTENT (BEFORE STRIP) ===");
    console.log(`[model] rawContent.length = ${rawContent.length}`);
    console.log(rawContent.length > 1000 ? rawContent.slice(0, 1000) + "..." : rawContent);
    console.log("[model] === END PARSED CONTENT ===");

    const content = stripSpecialTokens(rawContent);

    console.log("[model] === PARSED CONTENT (AFTER STRIP) ===");
    console.log(`[model] content.length after strip = ${content.length}`);
    console.log(content.length > 1000 ? content.slice(0, 1000) + "..." : content);
    console.log("[model] === END STRIPPED CONTENT ===");

    if (content) {
      // Yield word-by-word — no artificial delay, yields as fast as the
      // consumer reads.  This avoids background-tab setTimeout throttling
      // (browsers clamp sub-second timers to 1000ms in background tabs,
      // which would freeze the UI for minutes for long responses).
      const words = content.split(/(\s+)/);
      const nonEmpty = words.filter(Boolean);
      console.log(
        `[model] response parsed — ${content.length} chars, ${nonEmpty.length} words, yielding ${nonEmpty.length} chunks`
      );
      let chunkIndex = 0;
      for (const word of words) {
        if (!word) continue;
        chunkIndex++;
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
  }
}

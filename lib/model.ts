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

function convertLangChainMessageToModal(
  msg: BaseMessage
): { role: string; content: string } {
  if (msg instanceof HumanMessage) {
    return { role: "user", content: msg.content as string };
  }
  if (msg instanceof AIMessage) {
    return { role: "assistant", content: msg.content as string };
  }
  if (msg instanceof SystemMessage) {
    return { role: "system", content: msg.content as string };
  }
  // Fallback — treat _getType() as role
  const role = msg._getType?.() ?? "user";
  return { role: role === "ai" ? "assistant" : role, content: msg.content as string };
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
      messages: messages.map(convertLangChainMessageToModal),
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

    const content = data.choices?.[0]?.message?.content ?? "";
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
      messages: messages.map(convertLangChainMessageToModal),
      stream: true,
    };

    // 5-minute timeout — Modal cold starts (container spin-up + model
    // loading) can take 2-5 minutes on first request after idle.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300_000);

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
      if (err.name === "AbortError") {
        throw new Error(
          "Request timed out after 5 minutes. The model is still loading " +
          "on Modal (cold start). Please try again in a moment — the " +
          "container will be warm and respond faster."
        );
      }
      throw err;
    }
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Haney Chat API returned ${response.status}: ${errText.slice(0, 200)}`
      );
    }

    // Read the entire body as text first
    const raw = await response.text();

    // Detect format: SSE starts with "data:", plain JSON starts with "{"
    if (raw.trim().startsWith("{")) {
      // ── Plain JSON (Modal ignores stream:true) ──
      try {
        const data: ModalChatResponse = JSON.parse(raw);
        const content = data.choices?.[0]?.message?.content ?? "";
        if (content) {
          // Stream the content character-by-character so the client
          // still sees a "typing" effect even though we have the full
          // response already.
          for (let i = 0; i < content.length; i++) {
            const char = content[i]!;
            yield new ChatGenerationChunk({
              text: char,
              message: new AIMessageChunk(char),
            });
            // Tiny delay for visible streaming effect
            await new Promise((r) => setTimeout(r, 3));
          }
        }
      } catch {
        // ignore parse errors — no chunks yielded
      }
      return;
    }

    // ── True SSE stream ──
    const lines = raw.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr === "[DONE]") break;

      try {
        const chunk = JSON.parse(jsonStr) as ModalChatResponse;
        const choice = chunk.choices?.[0];
        const delta =
          (choice as any)?.delta?.content ??
          choice?.message?.content ??
          "";
        if (!delta) continue;

        yield new ChatGenerationChunk({
          text: delta,
          message: new AIMessageChunk(delta),
        });
      } catch {
        // skip malformed JSON lines
      }
    }
  }
}

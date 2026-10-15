import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { aiProvider, type AiProviderName } from "./config";

/**
 * One small adapter over the AI providers, so features don't care which one
 * runs (see config.ts for how it's chosen). Keys are read on the server only
 * and never reach the browser. With no key, AI features stay hidden.
 */

export type AiFailure = "busy" | "quota" | "blocked" | "failed";

/** A failure with a message that is safe to show people (no provider details). */
export class AiUnavailableError extends Error {
  constructor(
    readonly reason: AiFailure,
    message: string,
  ) {
    super(message);
  }
}

export interface AiRequest {
  /** Instructions: who the model is writing as and the output format. */
  system: string;
  /** The material to work from. Untrusted text inside it must already be fenced (see prompts.ts). */
  prompt: string;
}

export interface AiResult {
  text: string;
  provider: AiProviderName;
  model: string;
}

const TIMEOUT_MS = 45_000;
const CLAUDE_MODEL = "claude-opus-5-5";
// The first model that answers wins. On the free tier each model has its own
// quota and can be briefly overloaded, so a busy or exhausted model hands over
// to the next one.
const GEMINI_MODELS = [...new Set([process.env.GEMINI_MODEL || "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"])];

export async function generateText(request: AiRequest): Promise<AiResult> {
  const provider = aiProvider();
  if (provider === "claude") return generateWithClaude(request);
  if (provider === "gemini") return generateWithGemini(request);
  throw new AiUnavailableError("failed", "AI drafting isn't set up for this workspace.");
}

/* ---------- Gemini ---------- */

let gemini: GoogleGenAI | null = null;

async function generateWithGemini({ system, prompt }: AiRequest): Promise<AiResult> {
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY });
  let lastError: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: system,
          maxOutputTokens: 4096,
          // Short drafts don't need long reasoning; minimal thinking cuts the wait from ~10s to ~5s.
          ...(model.includes("lite") ? {} : { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }),
          // One attempt per model: retrying a busy model only delays the fallback.
          httpOptions: { timeout: TIMEOUT_MS, retryOptions: { attempts: 1 } },
        },
      });
      const text = response.text?.trim();
      if (!text) throw new AiUnavailableError("blocked", "The AI didn't write a draft for this one. Try again, or write it yourself.");
      return { text, provider: "gemini", model };
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && [429, 500, 503].includes(error.status)) continue;
      break;
    }
  }
  throw toUnavailable(lastError);
}

/* ---------- Claude ---------- */

let claude: Anthropic | null = null;

async function generateWithClaude({ system, prompt }: AiRequest): Promise<AiResult> {
  claude ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
  try {
    const response = await claude.beta.messages.create({
      model: CLAUDE_MODEL,
      // Thinking shares this budget; the drafts themselves are short.
      max_tokens: 8000,
      output_config: { effort: "low" },
      // If a safety check declines, the API retries on a suitable model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") {
      throw new AiUnavailableError("blocked", "The AI didn't write a draft for this one. Try again, or write it yourself.");
    }
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    if (!text) throw new AiUnavailableError("blocked", "The AI didn't write a draft for this one. Try again, or write it yourself.");
    return { text, provider: "claude", model: response.model };
  } catch (error) {
    throw toUnavailable(error);
  }
}

/* ---------- Errors ---------- */

function toUnavailable(error: unknown): AiUnavailableError {
  if (error instanceof AiUnavailableError) return error;
  const status =
    error instanceof ApiError ? error.status : error instanceof Anthropic.APIError ? (error.status ?? 0) : 0;
  console.error("[atrium] AI request failed", status || "", error instanceof Error ? error.message : error);
  if (status === 429) return new AiUnavailableError("quota", "The AI service has reached its limit for now. Try again later.");
  if (status >= 500 || error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiUnavailableError("busy", "The AI service is busy. Try again in a minute.");
  }
  return new AiUnavailableError("failed", "The AI couldn't write a draft right now. Try again in a moment.");
}

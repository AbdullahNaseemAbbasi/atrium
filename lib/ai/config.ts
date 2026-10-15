/**
 * Which AI provider is configured, from the server's environment. Kept apart
 * from provider.ts so pages can check it without loading the SDKs.
 * Claude when ANTHROPIC_API_KEY is set, otherwise Gemini (free tier), else none.
 */
export type AiProviderName = "claude" | "gemini";

export function aiProvider(): AiProviderName | null {
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  return null;
}

export function aiEnabled() {
  return aiProvider() !== null;
}

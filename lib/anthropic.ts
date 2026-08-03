import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic client factory, mirroring the lib/supabase/*.ts client-per-context
 * pattern used elsewhere in this project.
 *
 * Resolves the API key from ANTHROPIC_API_KEY automatically — never hardcode
 * a key here. Server-side use only (route handlers / server actions).
 */
export function getAnthropicClient() {
  return new Anthropic();
}

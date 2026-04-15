import Anthropic from '@anthropic-ai/sdk';

// Singleton client
let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5';

export async function callClaude(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  maxTokens = 1024
): Promise<string> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });
  const block = response.content[0];
  return block.type === 'text' ? block.text : '';
}

export async function callClaudeJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 512
): Promise<T | null> {
  try {
    const raw = await callClaude(systemPrompt, [{ role: 'user', content: userPrompt }], maxTokens);
    // Extract JSON from possible markdown fences
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : raw.trim();
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

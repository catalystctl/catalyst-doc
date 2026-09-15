/**
 * llm.mjs — provider abstraction for prose drafting and audit reasoning.
 *
 * Supports OpenAI-compatible endpoints (chat completions) and Anthropic
 * (messages API) using only the global fetch — no SDK dependencies.
 * Credentials come from the environment and are never written anywhere.
 *
 * When no credentials are configured, `available()` is false and callers run
 * in heuristic mode (deterministic classification + validation only).
 */

const OPENAI_KEY = process.env.DOCS_AGENT_API_KEY;
const OPENAI_BASE = (process.env.DOCS_AGENT_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
const OPENAI_MODEL = process.env.DOCS_AGENT_MODEL ?? 'gpt-4o-mini';
const ANTHROPIC_KEY = process.env.DOCS_AGENT_ANTHROPIC_KEY;
const ANTHROPIC_MODEL = process.env.DOCS_AGENT_ANTHROPIC_MODEL ?? 'claude-haiku-4-5';

export function available() {
  return Boolean(OPENAI_KEY || ANTHROPIC_KEY);
}

export function providerInfo() {
  if (OPENAI_KEY) return { provider: 'openai-compatible', baseUrl: OPENAI_BASE, model: OPENAI_MODEL };
  if (ANTHROPIC_KEY) return { provider: 'anthropic', model: ANTHROPIC_MODEL };
  return { provider: 'none (heuristic mode)' };
}

async function callOpenAI(system, user, maxTokens = 2000) {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
  const body = await res.json();
  return body.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic(system, user, maxTokens = 2000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
  const body = await res.json();
  return (body.content ?? []).map((b) => b.text ?? '').join('');
}

/** Draft documentation prose. The caller supplies verified facts; the model shapes them. */
export async function draft(system, user, maxTokens) {
  if (OPENAI_KEY) return callOpenAI(system, user, maxTokens);
  if (ANTHROPIC_KEY) return callAnthropic(system, user, maxTokens);
  throw new Error('No LLM provider configured (set DOCS_AGENT_API_KEY or DOCS_AGENT_ANTHROPIC_KEY)');
}

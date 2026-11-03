// Shared model access for the Vercel functions in /api.
// Files starting with "_" are not exposed as endpoints.
//
// Which model answers is decided by environment variables (Vercel →
// Project → Settings → Environment Variables). The first one set wins:
//   ANTHROPIC_API_KEY   (+ optional ANTHROPIC_MODEL, default claude-sonnet-5-5)
//   OPENAI_API_KEY      (+ optional OPENAI_MODEL, default gpt-4o-mini)
//   OPENROUTER_API_KEY  (+ optional OPENROUTER_MODEL, default openrouter/auto)
//   GEMINI_API_KEY      (+ optional GEMINI_MODEL, default gemini-2.5-flash)
//   LLM_BASE_URL        any OpenAI-compatible server (+ LLM_API_KEY, LLM_MODEL, LLM_NAME)
// With none of them set, a free public model (Pollinations) is used so the
// app works straight after deploying. Set DISABLE_FREE_MODEL=1 to turn that off.

const PRESETS = {
  anthropic: { kind: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5-5' },
  openai: { kind: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  openrouter: { kind: 'openai', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openrouter/auto' },
  gemini: { kind: 'openai', name: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
};

export function resolveProvider(env, override) {
  if (override && typeof override.apiKey === 'string' && override.apiKey.length > 8 && PRESETS[override.provider]) {
    const p = PRESETS[override.provider];
    return { ...p, apiKey: override.apiKey, model: String(override.model || p.model).slice(0, 120), source: 'user' };
  }
  if (env.ANTHROPIC_API_KEY) return { ...PRESETS.anthropic, apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || PRESETS.anthropic.model };
  if (env.OPENAI_API_KEY) return { ...PRESETS.openai, apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL || PRESETS.openai.model };
  if (env.OPENROUTER_API_KEY) return { ...PRESETS.openrouter, apiKey: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL || PRESETS.openrouter.model };
  if (env.GEMINI_API_KEY) return { ...PRESETS.gemini, apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || PRESETS.gemini.model };
  if (env.LLM_BASE_URL) return { kind: 'openai', name: env.LLM_NAME || 'Custom model', baseUrl: env.LLM_BASE_URL.replace(/\/+$/, ''), apiKey: env.LLM_API_KEY || '', model: env.LLM_MODEL || 'default' };
  if (env.DISABLE_FREE_MODEL !== '1') return { kind: 'openai', name: 'Free AI', baseUrl: 'https://text.pollinations.ai/openai', path: '', apiKey: '', model: env.FREE_MODEL || 'openai', free: true };
  return null;
}

export class UpstreamError extends Error {
  constructor(status, detail) { super(`Upstream ${status}`); this.status = status; this.detail = detail; }
}

// Anthropic needs strictly alternating roles; merge neighbours with the same role.
function alternate(messages) {
  const out = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + m.content; else out.push({ role: m.role, content: m.content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

function errorText(raw) {
  try { const j = JSON.parse(raw); return (j.error && (j.error.message || j.error)) || j.message || raw; } catch { return raw; }
}

// Calls the provider and returns a ReadableStream of plain UTF-8 text deltas.
export async function streamChat(p, { system, messages, maxTokens = 4096 }) {
  let res;
  const msgs = alternate(messages);
  if (p.kind === 'anthropic') {
    res = await fetch(`${p.baseUrl}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': p.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: p.model, max_tokens: maxTokens, system, messages: msgs, stream: true }),
    });
  } else {
    const headers = { 'content-type': 'application/json' };
    if (p.apiKey) headers.authorization = `Bearer ${p.apiKey}`;
    if (p.name === 'OpenRouter') { headers['X-Title'] = 'GAS Agent'; }
    res = await fetch(p.baseUrl + (p.path ?? '/chat/completions'), {
      method: 'POST', headers,
      body: JSON.stringify({ model: p.model, messages: [{ role: 'system', content: system }, ...msgs], stream: true }),
    });
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new UpstreamError(res.status, String(errorText(raw)).slice(0, 300));
  }
  const enc = new TextEncoder();
  const type = res.headers.get('content-type') || '';
  if (!type.includes('event-stream')) {
    const raw = await res.text();
    let text = raw;
    try {
      const j = JSON.parse(raw);
      text = p.kind === 'anthropic' ? (j.content || []).map((c) => c.text || '').join('') : (j.choices?.[0]?.message?.content ?? raw);
    } catch { /* plain text body */ }
    return new ReadableStream({ start(c) { c.enqueue(enc.encode(text)); c.close(); } });
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  return new ReadableStream({
    async pull(ctrl) {
      for (;;) {
        const nl = buf.indexOf('\n');
        if (nl >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') { ctrl.close(); return; }
          let j; try { j = JSON.parse(data); } catch { continue; }
          if (j.type === 'message_stop') { ctrl.close(); return; }
          if (j.type === 'error' || j.error) { ctrl.enqueue(enc.encode(`\n\n> Model error: ${j.error?.message || 'unknown error'}`)); continue; }
          const t = p.kind === 'anthropic'
            ? (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta' ? j.delta.text : '')
            : (j.choices?.[0]?.delta?.content || '');
          if (t) { ctrl.enqueue(enc.encode(t)); return; }
          continue;
        }
        const { done, value } = await reader.read();
        if (done) { ctrl.close(); return; }
        buf += dec.decode(value, { stream: true });
      }
    },
    cancel() { reader.cancel().catch(() => {}); },
  });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

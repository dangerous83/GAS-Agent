// POST /api/chat  →  streams the model's reply as plain text.
// Body: { messages: [{ role: 'user' | 'assistant', content }], system?, override? }
import { resolveProvider, streamChat, json } from './_llm.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  let body;
  try {
    const raw = await req.text();
    if (raw.length > 400000) return json({ error: 'The conversation is too long. Start a new chat.' }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: 'The request was not valid JSON.' }, 400); }

  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-24)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 24000) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ error: 'The last message must come from the user.' }, 400);

  const system = String(body.system || 'You are a helpful assistant.').slice(0, 8000);
  const provider = resolveProvider(process.env, body.override);
  if (!provider) return json({ error: 'No AI model is configured on the server. Add an API key in Vercel → Settings → Environment Variables.' }, 503);

  try {
    const stream = await streamChat(provider, { system, messages });
    return new Response(stream, {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-provider': provider.name, 'x-model': provider.model },
    });
  } catch (e) {
    if (e.status === 401 || e.status === 403) return json({ error: `${provider.name} rejected the API key. Check it in your settings.` }, 502);
    if (e.status === 429) return json({ error: `${provider.name} is rate limiting requests. Wait a moment and try again.` }, 429);
    if (e.status) return json({ error: `${provider.name} returned an error (${e.status}): ${e.detail || 'no details'}` }, 502);
    return json({ error: `Could not reach ${provider.name}. Try again in a moment.` }, 502);
  }
}

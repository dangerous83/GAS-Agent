// GET /api/health  →  tells the app which model is answering.
import { resolveProvider, json } from './_llm.js';

export const config = { runtime: 'edge' };

export default function handler() {
  const p = resolveProvider(process.env);
  if (!p) return json({ ok: false, error: 'No AI model configured' }, 503);
  return json({ ok: true, provider: p.name, model: p.model, free: !!p.free });
}

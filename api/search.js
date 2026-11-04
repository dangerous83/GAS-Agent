// GET /api/search?q=...  →  { query, results: [{ title, url, snippet, source }] }
// Free, key-less lookups: Wikipedia (search + page summaries) and the
// DuckDuckGo Instant Answer API. The chat uses these as cited sources.
import { json } from './_llm.js';

export const config = { runtime: 'edge' };

const UA = 'GAS-Agent/1.0 (+https://github.com/dangerous83/GAS-Agent)';
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

async function getJSON(url, ms = 5000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { accept: 'application/json', 'user-agent': UA, 'api-user-agent': UA } });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

// Turns "who is jose rizal?" into "jose rizal" for better matches.
export function cleanQuery(q) {
  return String(q || '')
    .replace(/^\s*(please\s+)?(can you\s+|could you\s+)?(search( the web| online)?( for)?|look ?up|google|find (info(rmation)?|out)( about| on)?|tell me (about|who)|research|give me (info(rmation)?|a profile|a bio(graphy)?)( about| on| of)?|what do you know about)\s+/i, '')
    .replace(/^\s*(who|what|where|when)\s+(is|was|are|were)\s+/i, '')
    .replace(/[?!.]+\s*$/, '')
    .trim()
    .slice(0, 160);
}

export async function wikipedia(q, lang = 'en') {
  const base = `https://${lang}.wikipedia.org`;
  const s = await getJSON(`${base}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&utf8=1&origin=*`);
  const hits = (s && s.query && s.query.search) || [];
  const out = await Promise.all(hits.map(async (h) => {
    const sum = await getJSON(`${base}/api/rest_v1/page/summary/${encodeURIComponent(h.title.replace(/ /g, '_'))}`);
    return {
      title: (sum && sum.title) || h.title,
      url: (sum && sum.content_urls && sum.content_urls.desktop && sum.content_urls.desktop.page) || `${base}/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}`,
      snippet: strip((sum && sum.extract) || h.snippet).slice(0, 1200),
      description: strip(sum && sum.description),
      source: 'Wikipedia',
    };
  }));
  return out.filter((r) => r.snippet);
}

export async function duckduckgo(q) {
  const j = await getJSON(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`);
  if (!j) return [];
  const out = [];
  if (j.AbstractText) out.push({ title: j.Heading || q, url: j.AbstractURL, snippet: strip(j.AbstractText).slice(0, 1200), source: j.AbstractSource || 'DuckDuckGo' });
  if (j.Answer) out.push({ title: q, url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`, snippet: strip(j.Answer), source: 'DuckDuckGo' });
  (j.RelatedTopics || []).flatMap((t) => (t.Topics ? t.Topics : [t])).filter((t) => t.Text && t.FirstURL).slice(0, 3)
    .forEach((t) => out.push({ title: strip(t.Text).split(' - ')[0].slice(0, 80), url: t.FirstURL, snippet: strip(t.Text).slice(0, 400), source: 'DuckDuckGo' }));
  return out;
}

export default async function handler(req) {
  const u = new URL(req.url);
  const raw = u.searchParams.get('q') || '';
  const q = cleanQuery(raw) || raw.trim().slice(0, 160);
  if (!q) return json({ error: 'Add a search query: /api/search?q=...' }, 400);
  const lang = /^[a-z]{2,3}$/.test(u.searchParams.get('lang') || '') ? u.searchParams.get('lang') : 'en';
  const [wiki, ddg] = await Promise.all([wikipedia(q, lang), duckduckgo(q)]);
  const seen = new Set(); const results = [];
  for (const r of [...wiki, ...ddg]) {
    const key = (r.url || r.title).toLowerCase(); if (!r.url || seen.has(key)) continue;
    seen.add(key); results.push(r); if (results.length >= 6) break;
  }
  return new Response(JSON.stringify({ query: q, results }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=600' } });
}

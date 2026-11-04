/* GAS Agent — white-label interface behavior (shared by all skins) */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const icon = (id, cls = '') => `<svg class="ico ${cls}"><use href="#i-${id}"/></svg>`;
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('gas:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('gas:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  const SKINS = {
    pro: { name: 'Pro', label: 'AI workspace · Navy' },
    glass: { name: 'Glass', label: 'Glassmorphism' },
    clay: { name: 'Clay', label: 'Claymorphism' },
    cyber: { name: 'Cyber', label: 'Cybersecurity' },
    nebula: { name: 'Nebula', label: 'AI purple' },
    gold: { name: 'Gold', label: 'Quiet luxury' },
    matte: { name: 'Matte', label: 'Matte black · Red' },
  };
  const DEFAULT_BRAND = { name: 'GAS Agent', tagline: 'Assistant' };

  const PROVIDERS = [
    { id: 'openrouter', name: 'OpenRouter', sub: 'Many models, one key', type: 'key', model: 'openrouter/auto' },
    { id: 'openai', name: 'OpenAI', sub: 'API key', type: 'key', model: 'gpt-4o' },
    { id: 'anthropic', name: 'Anthropic', sub: 'API key', type: 'key', model: 'claude-sonnet-5-5' },
    { id: 'gemini', name: 'Gemini', sub: 'Google AI Studio key', type: 'key', model: 'gemini-2.5-pro' },
    { id: 'lmstudio', name: 'LM Studio', sub: 'Local model', type: 'local', url: 'http://localhost:1234/v1', model: 'local-model' },
    { id: 'ollama', name: 'Ollama', sub: 'Local model', type: 'local', url: 'http://localhost:11434', model: 'llama3.1' },
  ];

  /* ---------------- State ---------------- */
  const now = () => Date.now();
  const seedConvos = () => [{
    id: 'c-website', title: 'Website proposal', updated: now() - 2 * 3600e3, role: 'marketing',
    messages: [
      { role: 'user', text: 'Draft a website redesign proposal for a mountain resort client.' },
      { role: 'ai', html: '<p>Here is the proposal outline. I kept it to one page so the client can approve it quickly.</p><ul><li><strong>Goal:</strong> double direct bookings within 6 months</li><li><strong>Scope:</strong> new home page, booking flow, room pages and a seasonal offers hub</li><li><strong>Timeline:</strong> 8 weeks in four 2-week sprints</li><li><strong>Budget:</strong> ₱480,000, paid 40 / 40 / 20</li></ul><p>Want me to turn this into a Word document with a cover page?</p>' },
    ],
  }, {
    id: 'c-campaign', title: 'Campaign ideas', updated: now() - 26 * 3600e3, role: 'marketing',
    messages: [
      { role: 'user', text: 'Give me campaign ideas for our new olive-oil skincare line.' },
      { role: 'ai', html: '<p>Three directions, each with a hook and the channels that fit it:</p><ol><li><strong>“Mediterranean morning”</strong>: slow, sunlit product films for Reels and TikTok</li><li><strong>Ingredient transparency</strong>: farm-to-bottle story with the grower, for YouTube and email</li><li><strong>7-day glow challenge</strong>: creator partnerships with a discount code per creator</li></ol><p>I can build the content calendar and budget split next.</p>' },
    ],
  }, {
    id: 'c-report', title: 'Monthly report', updated: now() - 30 * 3600e3, role: 'finance',
    messages: [
      { role: 'user', text: 'Summarize this month: revenue ₱2.4M, expenses ₱1.7M, last month revenue ₱2.1M.' },
      { role: 'ai', html: '<p><strong>October at a glance</strong></p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Metric</th><th>October</th><th>Change</th></tr></thead><tbody><tr><td>Revenue</td><td>₱2,400,000</td><td>+14.3%</td></tr><tr><td>Expenses</td><td>₱1,700,000</td><td>n/a</td></tr><tr><td>Net income</td><td>₱700,000</td><td>29.2% margin</td></tr></tbody></table></div><p>Revenue grew faster than costs. Next step: break expenses down by category to find the biggest driver.</p>' },
    ],
  }];

  const state = {
    brand: Object.assign({}, DEFAULT_BRAND, store.get('brand', {})),
    model: store.get('model', null),
    convos: store.get('convos', null) || seedConvos(),
    artifacts: store.get('artifacts_v2', null) || [
      { name: 'Board update.docx', kind: 'docx', meta: 'Word document · 2 pages', time: now() - 86400e3 * 2 },
      { name: 'Hiring plan.xlsx', kind: 'xlsx', meta: 'Spreadsheet · 3 sheets', time: now() - 86400e3 * 5 },
      { name: 'Product one-pager.pdf', kind: 'pdf', meta: 'PDF · 1 page', time: now() - 86400e3 * 9 },
      { name: 'Launch banner.png', kind: 'png', meta: 'Image · 4 variations · 1600 × 1000', time: now() - 86400e3 * 12, media: { kind: 'image', prompt: 'neon city skyline launch banner at night', seed: 314159 } },
      { name: 'Product teaser.webm', kind: 'webm', meta: 'Video · 6 s · 1280 × 720', time: now() - 86400e3 * 14, media: { kind: 'video', prompt: 'abstract purple AI flow', seed: 271828 } },
    ],
    current: null,
    skin: null,
    section: 'chat',
    mode: 'Normal',
    choice: 'Auto',
    auto: false,
    voice: false,
    workspace: { name: 'Workspace', files: null },
    attachments: [],
    busy: false,
    log: [],
  };
  state.current = null;

  const save = () => {
    if (!state.prefs || state.prefs.saveHistory) store.set('convos', state.convos.slice(0, 40));
    store.set('artifacts_v2', state.artifacts.slice(0, 40));
    if (state.projects) store.set('projects', state.projects.map(({ id, ico, c, title, text, foot }) => ({ id, ico, c, title, text, foot })));
  };

  /* ---------------- Logo ---------------- */
  let logoN = 0;
  function logoSVG(size) {
    const id = 'gasg' + (++logoN);
    return `<svg class="logo-svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="6" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
        <stop offset="0" style="stop-color:var(--logo-a)"/><stop offset="1" style="stop-color:var(--logo-b)"/></linearGradient></defs>
      <rect x="2" y="2" width="60" height="60" rx="17" fill="url(#${id})"/>
      <rect class="logo-edge" x="2.75" y="2.75" width="58.5" height="58.5" rx="16.4" fill="none"/>
      <path class="logo-ink" d="M42.6 21.4A15 15 0 1 0 47 34H33" fill="none" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle class="logo-dot" cx="33" cy="34" r="4"/>
      <circle class="logo-orbit" cx="49.5" cy="14.5" r="3.3"/>
    </svg>`;
  }
  const STANDALONE_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256"><defs><linearGradient id="g" x1="6" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3A6BFF"/><stop offset="1" stop-color="#18C7B8"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="17" fill="url(#g)"/><rect x="2.75" y="2.75" width="58.5" height="58.5" rx="16.4" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.5"/><path d="M42.6 21.4A15 15 0 1 0 47 34H33" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="33" cy="34" r="4" fill="#fff"/><circle cx="49.5" cy="14.5" r="3.3" fill="#fff"/></svg>`;

  function paintLogos(root = document) {
    $$('[data-logo]', root).forEach((el) => { if (!el.firstElementChild) el.innerHTML = logoSVG(el.dataset.logo || 32); });
  }

  /* ---------------- Brand (white label) ---------------- */
  window.GASBrand = () => state.brand.name;
  function applyBrand() {
    const { name, tagline } = state.brand;
    $$('[data-brand="name"]').forEach((el) => { el.textContent = name; });
    $$('[data-brand="tagline"]').forEach((el) => { el.textContent = tagline; });
    $$('[data-brand="slug"]').forEach((el) => { el.textContent = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent'; });
    document.title = state.skin ? `${name} · ${SKINS[state.skin].name}` : `${name} Studio`;
  }

  /* ---------------- Toasts & log ---------------- */
  function toast(msg, ico = 'check', action) {
    const t = document.createElement('div');
    if (action) $$('#toasts .toast.has-act').forEach((old) => old.remove());
    t.className = 'toast' + (action ? ' has-act' : '');
    t.innerHTML = `${icon(ico)}<span>${esc(msg)}</span>`;
    if (action) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-act'; b.textContent = action.label;
      b.onclick = () => { action.run(); t.remove(); }; t.append(b);
    }
    $('#toasts').append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, action ? 5000 : 2600);
  }
  function log(msg) {
    const d = new Date();
    state.log.unshift({ t: d.toTimeString().slice(0, 8), msg });
    state.log = state.log.slice(0, 60);
    if (!$('#activity').hidden) renderLog();
  }
  function renderLog() {
    $('#log').innerHTML = state.log.map((l) => `<li><time>${l.t}</time><span>${esc(l.msg)}</span></li>`).join('') || '<li>No activity yet.</li>';
  }

  /* ---------------- Media generator (images + video, no API) ----------------
     Scenes are painted procedurally on <canvas> from the prompt text, so the
     same prompt + seed always gives the same picture. Video frames use a loop
     parameter t in [0, 1) so clips repeat seamlessly. */
  const Gen = (() => {
    const TAU = Math.PI * 2;
    const hash = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
    const rng = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const PALS = {
      sunset: ['#140b2e', '#4a1d6b', '#b8336a', '#ff7e5f', '#ffd194'],
      night: ['#03050f', '#0a1433', '#1d3a7a', '#5b82d6', '#dfe8ff'],
      forest: ['#04110b', '#0d2e20', '#1f5e40', '#6fae6a', '#e3f2c1'],
      gold: ['#0e0a04', '#33250c', '#7a5a1c', '#d4af37', '#fbe9b0'],
      neon: ['#06020f', '#240a52', '#7c3aed', '#ec4899', '#22d3ee'],
      ocean: ['#020f1f', '#06325c', '#1b6ca8', '#62b6e0', '#e6f6ff'],
      dawn: ['#1a1433', '#3d3a7a', '#8f7fc9', '#f5a3b5', '#fff1d6'],
      desert: ['#1d0f08', '#5a2a14', '#b45a2a', '#f0a35e', '#ffe2b0'],
    };
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
    const mix = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };

    function scene(p) {
      const t = p.toLowerCase();
      if (/city|skyline|urban|cyberpunk|building|street|downtown|tower/.test(t)) return 'city';
      if (/ocean|sea|wave|beach|water|lake|coast|surf/.test(t)) return 'ocean';
      if (/space|galaxy|star|planet|nebula|cosmic|universe|moon|orbit/.test(t)) return 'space';
      if (/forest|tree|jungle|woods|pine/.test(t)) return 'forest';
      if (/mountain|landscape|valley|hill|desert|dune|canyon|peak/.test(t)) return 'mountains';
      return 'abstract';
    }
    function palette(p, r) {
      const t = p.toLowerCase();
      const pick = [[/sunset|sunrise|dusk|evening|warm/, 'sunset'], [/night|midnight|dark|moon/, 'night'], [/forest|jungle|green|nature/, 'forest'], [/gold|luxury|premium/, 'gold'],
        [/neon|cyber|futur|synth|purple|ai\b/, 'neon'], [/desert|sand|dune|canyon/, 'desert'], [/dawn|morning|pastel|soft|calm/, 'dawn'], [/ocean|sea|wave|blue|water/, 'ocean']];
      for (const [re, k] of pick) if (re.test(t)) return PALS[k];
      const keys = Object.keys(PALS); return PALS[keys[Math.floor(r() * keys.length)]];
    }
    const isNight = (p) => /night|midnight|dark|space|galaxy|star|moon|neon|cyber/.test(p.toLowerCase());

    function sky(c, w, h, P, horizon) {
      const g = c.createLinearGradient(0, 0, 0, h * horizon);
      g.addColorStop(0, P[0]); g.addColorStop(.5, P[1]); g.addColorStop(.85, P[2]); g.addColorStop(1, P[3]);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    function sun(c, x, y, rad, P, night) {
      const glow = c.createRadialGradient(x, y, 0, x, y, rad * 5);
      glow.addColorStop(0, rgba(P[4], night ? .35 : .6)); glow.addColorStop(1, rgba(P[4], 0));
      c.fillStyle = glow; c.fillRect(x - rad * 5, y - rad * 5, rad * 10, rad * 10);
      c.fillStyle = night ? P[4] : mix(P[4], '#ffffff', .3);
      c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
    }
    function stars(c, w, h, seed, n, maxY, t) {
      const r = rng(seed + 11);
      for (let i = 0; i < n; i++) {
        const x = r() * w, y = r() * h * maxY, s = .4 + r() * 1.3, ph = r();
        c.fillStyle = `rgba(255,255,255,${(.35 + .65 * r()) * (.55 + .45 * Math.sin(TAU * (t * 2 + ph)))})`;
        c.fillRect(x, y, s, s);
      }
    }
    function ridge(c, w, h, y0, amp, color, seed, shift) {
      const r = rng(seed); const f = [1, 2, 3, 5].map((k) => ({ k, a: r() / k, p: r() * TAU }));
      c.fillStyle = color; c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) {
        let y = 0; for (const q of f) y += q.a * Math.sin(TAU * q.k * (x / w + shift) + q.p);
        c.lineTo(x, y0 - y * amp);
      }
      c.lineTo(w, h); c.closePath(); c.fill();
    }
    function fog(c, w, h, y, P, a) {
      const g = c.createLinearGradient(0, y - h * .12, 0, y + h * .1);
      g.addColorStop(0, rgba(P[3], 0)); g.addColorStop(.5, rgba(P[3], a)); g.addColorStop(1, rgba(P[3], 0));
      c.fillStyle = g; c.fillRect(0, y - h * .12, w, h * .22);
    }

    const SCENES = {
      city(c, w, h, P, seed, t, night) {
        sky(c, w, h, P, .8);
        if (night) stars(c, w, h, seed, 140, .5, t);
        sun(c, w * (.3 + rng(seed)() * .4), h * .5, h * .07, P, night);
        const horizon = h * .78;
        for (let L = 0; L < 3; L++) {
          const r = rng(seed + L * 97); let x = -10;
          const col = mix(P[1], P[0], .35 + L * .3);
          while (x < w) {
            const bw = (24 + r() * 60) * (w / 900) * (1 + L * .25);
            const bh = h * (.12 + r() * .32) * (.7 + L * .25);
            c.fillStyle = col; c.fillRect(x, horizon - bh, bw, bh + h);
            if (r() > .6) c.fillRect(x + bw * .45, horizon - bh - h * .04, bw * .08, h * .04);
            const ws = Math.max(3, w / 300);
            for (let wy = horizon - bh + ws * 2; wy < horizon - ws; wy += ws * 2.4) {
              for (let wx = x + ws; wx < x + bw - ws; wx += ws * 2.2) {
                const k = r(); const lit = k < .28 + .1 * Math.sin(TAU * (t + k * 5));
                if (lit) { c.fillStyle = rgba(P[4], (.25 + L * .3) * (.6 + .4 * k)); c.fillRect(wx, wy, ws, ws * 1.2); }
              }
            }
            x += bw + 2 + r() * 6;
          }
        }
        c.fillStyle = mix(P[0], '#000000', .3); c.fillRect(0, horizon, w, h - horizon);
        const refl = c.createLinearGradient(0, horizon, 0, h); refl.addColorStop(0, rgba(P[3], .25)); refl.addColorStop(1, rgba(P[3], 0));
        c.fillStyle = refl; c.fillRect(0, horizon, w, h - horizon);
        const r2 = rng(seed + 5);
        for (let i = 0; i < 10; i++) {
          const y = horizon + 6 + r2() * (h - horizon - 12), sp = .5 + r2(), dir = r2() > .5 ? 1 : -1;
          const x = (((r2() + dir * t * sp) % 1) + 1) % 1 * w;
          c.fillStyle = rgba(i % 2 ? P[4] : P[3], .9); c.fillRect(x, y, w * .02, 2);
        }
        fog(c, w, h, horizon, P, .25);
      },
      ocean(c, w, h, P, seed, t, night) {
        const horizon = h * .55;
        sky(c, w, h, P, .58);
        if (night) stars(c, w, h, seed, 160, .5, t);
        const sx = w * (.35 + rng(seed)() * .3);
        sun(c, sx, horizon - h * .1, h * .07, P, night);
        const sea = c.createLinearGradient(0, horizon, 0, h);
        sea.addColorStop(0, P[2]); sea.addColorStop(.4, P[1]); sea.addColorStop(1, P[0]);
        c.fillStyle = sea; c.fillRect(0, horizon, w, h - horizon);
        for (let i = 0; i < 26; i++) {
          const y = horizon + 4 + i * (h - horizon) / 30; const len = (w * .14) * (1 - i / 34);
          const jit = Math.sin(TAU * (t * 2 + i * .17)) * w * .012;
          c.fillStyle = rgba(P[4], .55 * (1 - i / 26)); c.fillRect(sx - len / 2 + jit, y, len, 1.6);
        }
        for (let i = 0; i < 7; i++) {
          const y0 = horizon + Math.pow(i + 1, 1.55) * (h - horizon) / 22; const amp = 2 + i * 2.6;
          const r = rng(seed + i * 13); const ph = r() * TAU; const f = 3 + Math.floor(r() * 4); const dir = i % 2 ? 1 : -1;
          c.beginPath(); c.moveTo(0, h);
          for (let x = 0; x <= w; x += 6) c.lineTo(x, y0 + Math.sin(TAU * f * (x / w) + ph + dir * TAU * t) * amp);
          c.lineTo(w, h); c.closePath();
          c.fillStyle = rgba(mix(P[1], P[0], i / 7), .55);
          c.fill();
          c.strokeStyle = rgba(P[4], .12 + i * .02); c.lineWidth = 1; c.stroke();
        }
      },
      mountains(c, w, h, P, seed, t, night) {
        sky(c, w, h, P, .75);
        if (night) stars(c, w, h, seed, 150, .55, t);
        sun(c, w * (.25 + rng(seed)() * .5), h * .38, h * .08, P, night);
        const layers = 5;
        for (let i = 0; i < layers; i++) {
          const k = i / (layers - 1);
          ridge(c, w, h, h * (.5 + k * .32), h * (.16 - k * .05), mix(P[2], P[0], .25 + k * .7), seed + i * 31, t * (i % 2 ? 1 : 0) + i * .13);
          if (i < layers - 1) fog(c, w, h, h * (.55 + k * .32), P, .18);
        }
      },
      space(c, w, h, P, seed, t) {
        const bg = c.createRadialGradient(w * .5, h * .5, 0, w * .5, h * .5, w * .8);
        bg.addColorStop(0, P[1]); bg.addColorStop(1, P[0]); c.fillStyle = bg; c.fillRect(0, 0, w, h);
        const r = rng(seed + 3);
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 8; i++) {
          const x = w * (.15 + r() * .7) + Math.sin(TAU * (t + i * .1)) * w * .02, y = h * (.15 + r() * .7) + Math.cos(TAU * (t + i * .13)) * h * .02;
          const rad = w * (.15 + r() * .25); const col = P[2 + (i % 3)];
          const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, rgba(col, .22)); g.addColorStop(1, rgba(col, 0));
          c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
        c.globalCompositeOperation = 'source-over';
        stars(c, w, h, seed, 380, 1, t);
        const px = w * (.62 + r() * .2), py = h * (.55 + r() * .15), pr = h * (.16 + r() * .08);
        const pg = c.createRadialGradient(px - pr * .4, py - pr * .4, pr * .1, px, py, pr);
        pg.addColorStop(0, P[4]); pg.addColorStop(.45, P[3]); pg.addColorStop(1, mix(P[1], '#000000', .5));
        c.save(); c.translate(px, py); c.rotate(-.35);
        c.strokeStyle = rgba(P[4], .35); c.lineWidth = pr * .06; c.beginPath(); c.ellipse(0, 0, pr * 1.9, pr * .45, 0, Math.PI, TAU); c.stroke();
        c.restore();
        c.fillStyle = pg; c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill();
        c.save(); c.translate(px, py); c.rotate(-.35);
        c.strokeStyle = rgba(P[4], .55); c.lineWidth = pr * .06; c.beginPath(); c.ellipse(0, 0, pr * 1.9, pr * .45, 0, 0, Math.PI); c.stroke();
        c.restore();
        const sh = (t * 1.0) % 1; if (sh < .25) { const k = sh / .25; c.strokeStyle = `rgba(255,255,255,${.8 * (1 - k)})`; c.lineWidth = 1.5; c.beginPath(); c.moveTo(w * (.1 + k * .4), h * (.1 + k * .2)); c.lineTo(w * (.1 + k * .4) - w * .06, h * (.1 + k * .2) - h * .03); c.stroke(); }
      },
      forest(c, w, h, P, seed, t, night) {
        sky(c, w, h, P, .7);
        if (night) stars(c, w, h, seed, 120, .45, t);
        sun(c, w * (.3 + rng(seed)() * .4), h * .3, h * .07, P, night);
        for (let L = 0; L < 4; L++) {
          const r = rng(seed + L * 41); const k = L / 3; const base = h * (.6 + k * .3);
          c.fillStyle = mix(P[2], P[0], .3 + k * .65);
          c.fillRect(0, base, w, h - base);
          let x = -20;
          while (x < w + 20) {
            const th = h * (.12 + r() * .14) * (1 + k * .8), tw = th * (.32 + r() * .1);
            c.beginPath(); c.moveTo(x, base - th);
            for (let s = 1; s <= 3; s++) { c.lineTo(x + tw * s / 3, base - th + th * s / 3); c.lineTo(x + tw * s / 6, base - th + th * s / 3); }
            for (let s = 3; s >= 1; s--) { c.lineTo(x - tw * s / 6, base - th + th * s / 3); c.lineTo(x - tw * s / 3, base - th + th * s / 3); }
            c.closePath(); c.fill();
            x += tw * (.6 + r() * .8);
          }
          if (L < 3) { c.save(); c.translate(Math.sin(TAU * (t + L * .2)) * w * .03, 0); fog(c, w, h, base + h * .02, P, .22); c.restore(); }
        }
      },
      abstract(c, w, h, P, seed, t) {
        c.fillStyle = P[0]; c.fillRect(0, 0, w, h);
        const r = rng(seed + 7);
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 7; i++) {
          const cx = w * (.15 + r() * .7), cy = h * (.15 + r() * .7), ax = w * (.06 + r() * .12), ay = h * (.06 + r() * .12), ph = r();
          const x = cx + ax * Math.sin(TAU * (t + ph)), y = cy + ay * Math.cos(TAU * (t + ph * 1.3));
          const rad = w * (.18 + r() * .22); const col = P[2 + (i % 3)];
          const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, rgba(col, .55)); g.addColorStop(1, rgba(col, 0));
          c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
        c.globalCompositeOperation = 'source-over';
        c.lineWidth = Math.max(1, w / 700);
        for (let i = 0; i < 18; i++) {
          const y0 = h * (i / 18) + Math.sin(TAU * (t + i * .05)) * h * .03; const a = r() * h * .25;
          c.strokeStyle = rgba(P[4], .05 + r() * .12); c.beginPath(); c.moveTo(-10, y0);
          c.bezierCurveTo(w * .3, y0 - a, w * .7, y0 + a, w + 10, y0 + Math.cos(TAU * (t + i * .07)) * h * .05); c.stroke();
        }
      },
    };

    function draw(c, w, h, prompt, seed, t) {
      const r = rng(seed); const P = palette(prompt, r); const s = scene(prompt);
      c.save(); c.clearRect(0, 0, w, h);
      SCENES[s](c, w, h, P, seed, t, isNight(prompt));
      const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)');
      c.fillStyle = v; c.fillRect(0, 0, w, h);
      c.restore();
    }
    function title(prompt, max = 48) {
      let p = prompt.trim().replace(/^(please\s+)?(can you\s+|could you\s+)?(generate|create|make|draw|render|design|produce|paint|show)(\s+me)?\s+/i, '')
        .replace(/^(an?\s+|the\s+)?(\d+[- ]?(second|sec|s)\s+)?(hd\s+)?(image|picture|photo|illustration|video|clip|animation|poster|wallpaper|artwork|render)s?\s*(of|showing|with|about|for)?\s*/i, '')
        .replace(/[.!?]+$/, '').trim();
      if (!p) p = 'Untitled';
      p = p.charAt(0).toUpperCase() + p.slice(1);
      return p.length > max ? p.slice(0, max - 2).trim() + '…' : p;
    }
    return { draw, hash, title, scene };
  })();

  function canvasFor(spec, w, h, t = 0.3) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    Gen.draw(cv.getContext('2d'), w, h, spec.prompt, spec.seed, t);
    return cv;
  }
  const variationSeed = (spec, i) => (spec.seed + i * 7919) >>> 0;
  function downloadCanvas(cv, name) {
    try {
      const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = name; document.body.append(a); a.click(); a.remove();
      toast(`Downloading ${name}`, 'download');
    } catch { toast('Download was blocked by the browser.', 'x'); }
  }

  const AI_MEDIA = /^https?:$/.test(location.protocol);
  const aiImageURL = (prompt, seed, w, h) => `https://image.pollinations.ai/prompt/${encodeURIComponent(Gen.title(prompt, 400))}?width=${w}&height=${h}&seed=${seed % 2147483647}&nologo=true&model=flux`;
  function kenBurns(ctx, W, H, img, t) {
    const k = 0.5 - 0.5 * Math.cos(t * Math.PI * 2), s = 1.05 + 0.1 * k;
    const iw = W * s, ih = H * s, ox = Math.sin(t * Math.PI * 2) * W * 0.025, oy = (k - 0.5) * H * 0.03;
    ctx.drawImage(img, (W - iw) / 2 + ox, (H - ih) / 2 + oy, iw, ih);
    const g = ctx.createLinearGradient(W * (t * 1.6 - 0.5), 0, W * (t * 1.6 - 0.1), H);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  async function downloadURL(url, name) {
    try {
      const blob = await (await fetch(url)).blob(); const u = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 4000); toast(`Downloading ${name}`, 'download');
    } catch { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove(); }
  }
  function mountImages(el, spec) {
    el.className = 'gen-wrap';
    const grid = document.createElement('div'); grid.className = 'gen-grid';
    for (let i = 0; i < 4; i++) {
      const fig = document.createElement('figure'); fig.tabIndex = 0; fig.setAttribute('role', 'button'); fig.setAttribute('aria-label', `Open variation ${i + 1}`);
      const ph = canvasFor({ prompt: spec.prompt, seed: variationSeed(spec, i) }, 640, 400); fig.append(ph);
      if (AI_MEDIA) {
        fig.classList.add('loading');
        const img = new Image(); img.alt = `${Gen.title(spec.prompt, 120)}, variation ${i + 1}`; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
        const stop = setTimeout(() => { img.src = ''; fig.classList.remove('loading'); }, 60000);
        img.onload = () => { clearTimeout(stop); ph.replaceWith(img); fig.classList.remove('loading'); fig.dataset.ai = '1'; };
        img.onerror = () => { clearTimeout(stop); fig.classList.remove('loading'); };
        img.src = aiImageURL(spec.prompt, variationSeed(spec, i), 960, 600);
      }
      const cap = document.createElement('figcaption'); cap.textContent = `V${i + 1}`; fig.append(cap);
      const open = () => openLightbox(Object.assign({}, spec, { variant: i }));
      fig.addEventListener('click', open);
      fig.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      grid.append(fig);
    }
    el.replaceChildren(grid);
  }

  function mountVideo(el, spec, opts = {}) {
    const W = opts.w || 960, H = opts.h || 540, DUR = 6;
    el.className = 'player';
    el.innerHTML = `<canvas width="${W}" height="${H}"></canvas><span class="pl-badge">HD · ${DUR}s</span>
      <div class="player-bar"><button type="button" class="pl-btn pl-play" aria-label="Pause">${icon('pause')}</button>
      <input type="range" min="0" max="1000" value="0" aria-label="Seek"><span class="pl-time">0:00 / 0:0${DUR}</span>
      <button type="button" class="pl-btn pl-dl" aria-label="Download clip" title="Download as WebM">${icon('download')}</button></div>`;
    const cv = $('canvas', el), ctx = cv.getContext('2d'), range = $('input', el), time = $('.pl-time', el), play = $('.pl-play', el);
    let playing = !reduced, pos = 0, last = performance.now(), seeking = false;
    let key = null;
    const paint = () => (key ? kenBurns(ctx, W, H, key, pos) : Gen.draw(ctx, W, H, spec.prompt, spec.seed, pos));
    if (AI_MEDIA) {
      const im = new Image(); im.crossOrigin = 'anonymous'; im.referrerPolicy = 'no-referrer';
      im.onload = () => { key = im; $('.pl-badge', el).textContent = `AI · ${DUR}s`; paint(); };
      im.src = aiImageURL(spec.prompt, spec.seed, 1280, 720);
    }
    const setBtn = () => { play.innerHTML = icon(playing ? 'pause' : 'play'); play.setAttribute('aria-label', playing ? 'Pause' : 'Play'); };
    setBtn(); paint();
    function frame(now) {
      if (!cv.isConnected) return;
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      if (playing && !seeking && cv.offsetParent !== null) {
        pos = (pos + dt / DUR) % 1; paint();
        range.value = Math.round(pos * 1000);
        time.textContent = `0:0${Math.floor(pos * DUR)} / 0:0${DUR}`;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    play.addEventListener('click', () => { playing = !playing; setBtn(); });
    range.addEventListener('input', () => { seeking = true; pos = range.value / 1000; paint(); time.textContent = `0:0${Math.floor(pos * DUR)} / 0:0${DUR}`; });
    range.addEventListener('change', () => { seeking = false; });
    $('.pl-dl', el).addEventListener('click', () => {
      if (!cv.captureStream || !window.MediaRecorder) { toast('Video export is not supported in this browser.', 'x'); return; }
      try {
        const type = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        const rec = new MediaRecorder(cv.captureStream(30), { mimeType: type }); const chunks = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => {
          $('.pl-rec', el)?.remove();
          const url = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
          const a = document.createElement('a'); a.href = url; a.download = Gen.title(spec.prompt) + '.webm'; document.body.append(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          toast('Clip exported as WebM', 'download');
        };
        pos = 0; playing = true; setBtn();
        el.insertAdjacentHTML('beforeend', '<span class="pl-rec">● REC</span>');
        rec.start(); toast(`Recording the ${DUR}-second clip…`, 'video');
        setTimeout(() => rec.stop(), DUR * 1000 + 100);
      } catch { toast('Video export could not start in this browser.', 'x'); }
    });
  }

  function hydrateMedia(root) {
    $$('.media-slot', root).forEach((el) => {
      let spec; try { spec = JSON.parse(el.dataset.media); } catch { return; }
      el.classList.remove('media-slot');
      if (spec.kind === 'video') mountVideo(el, spec); else mountImages(el, spec);
    });
  }

  function openLightbox(spec) {
    const stage = $('#lbStage'); const name = Gen.title(spec.prompt);
    $('#lb-h').textContent = name;
    let cv = null, aiImg = null;
    if (spec.kind === 'video') {
      $('#lbMeta').textContent = 'Video · 6 s loop · 1280 × 720 · rendered in your browser';
      const holder = document.createElement('div'); stage.replaceChildren(holder);
      mountVideo(holder, spec, { w: 1280, h: 720 });
    } else {
      const v = spec.variant || 0;
      $('#lbMeta').textContent = `Image · variation ${v + 1} of 4 · 1600 × 1000 · seed ${variationSeed(spec, v)}`;
      cv = canvasFor({ prompt: spec.prompt, seed: variationSeed(spec, v) }, 1600, 1000);
      stage.replaceChildren(cv);
      if (AI_MEDIA) {
        const img = new Image(); img.className = 'lb-img'; img.alt = name; img.referrerPolicy = 'no-referrer';
        img.onload = () => { if (stage.contains(cv)) { stage.replaceChildren(img); aiImg = img; $('#lbMeta').textContent = `AI image · variation ${v + 1} of 4 · 1600 × 1000 · Flux`; } };
        img.src = aiImageURL(spec.prompt, variationSeed(spec, v), 1600, 1000);
      }
    }
    const acts = $('#lbActions'); acts.innerHTML = '';
    const mk = (label, ico, fn, primary) => { const b = document.createElement('button'); b.type = 'button'; b.className = primary ? 'btn-primary' : 'btn-ghost'; b.innerHTML = icon(ico) + esc(label); b.onclick = fn; acts.append(b); };
    if (spec.kind !== 'video') {
      mk('Previous', 'left', () => openLightbox(Object.assign({}, spec, { variant: ((spec.variant || 0) + 3) % 4 })));
      mk('Next', 'right', () => openLightbox(Object.assign({}, spec, { variant: ((spec.variant || 0) + 1) % 4 })));
      mk('Download', 'download', () => (aiImg ? downloadURL(aiImg.src, `${name} v${(spec.variant || 0) + 1}.jpg`) : downloadCanvas(cv, `${name} v${(spec.variant || 0) + 1}.png`)), true);
    } else {
      mk('Download WebM', 'download', () => $('#lbStage .pl-dl').click(), true);
    }
    if ($('#lightbox').hidden) openModal('lightbox');
  }

  /* ---------------- Nebula: interactive neural core ----------------
     343 neurons morph between four shapes (Reason = sphere, Create = double
     helix, Analyze = lattice cube, Remember = torus). Links form between
     nearby neurons; signals travel along links. Click to pulse, drag to spin,
     hover to light neurons, type in the composer to make it "listen". */
  const Core = (() => {
    const TAU = Math.PI * 2, N = 343;
    const MODES = {
      reason: { label: 'Reasoning', link: .25, thought: 'I break a problem into steps, weigh the options and explain my thinking.', prompt: "Draft a one-page summary of a topic I'm working on and save it as a Word document." },
      create: { label: 'Creating', link: .27, thought: 'I turn a prompt into images and short videos you can view and download.', prompt: 'Generate an image of a futuristic city at sunset.' },
      analyze: { label: 'Analyzing', link: .27, thought: 'I organise numbers into tables, trackers and clear summaries.', prompt: 'Build a simple Excel tracker for my top priorities this quarter.' },
      remember: { label: 'Remembering', link: .3, thought: 'I read the files in your workspace and keep context across chats.', prompt: "Look at the files in my workspace folder and tell me what's there." },
    };
    const INSIGHTS = [
      (l, ms) => `Pulse sent across ${l.toLocaleString()} links in ${ms} ms.`,
      () => 'Signal received. Re-ranking what I know about your workspace.',
      () => 'Pattern found: three of your recent requests were about planning.',
      (l) => `${Math.round(l / 3.1).toLocaleString()} pathways lit. Context window refreshed.`,
      () => 'Thinking in parallel: summarising, checking facts, drafting.',
    ];
    const shapes = {};
    const P = new Float32Array(N * 3), V = new Float32Array(N * 3);
    const SX = new Float32Array(N), SY = new Float32Array(N), SZ = new Float32Array(N), SS = new Float32Array(N);
    let cv, ctx, W = 0, H = 0, dpr = 1, mode = 'reason', thr = .25;
    let ry = 0, rx = -.32, vy = .0042, tilt = 0, pointer = null, drag = null, energy = .25, listenT = 0, insightI = 0;
    let pulses = [], waves = [], links = new Int16Array(0), linkCount = 0, frameN = 0, started = false;

    function build() {
      const sp = [], hx = [], cu = [], to = [];
      for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963; sp.push(Math.cos(th) * r, y, Math.sin(th) * r); }
      const M = Math.ceil(N / 3);
      for (let i = 0; i < N; i++) {
        const k = Math.floor(i / 3), t = k / M, a = t * Math.PI * 5.2, y = (t * 2 - 1) * 1.15;
        const A = [Math.cos(a) * .58, y, Math.sin(a) * .58], B = [Math.cos(a + Math.PI) * .58, y, Math.sin(a + Math.PI) * .58];
        const kind = i % 3;
        if (kind === 0) hx.push(...A); else if (kind === 1) hx.push(...B);
        else { const f = (k % 4 === 0) ? ((i * .618) % 1) : -1; if (f >= 0) hx.push(A[0] + (B[0] - A[0]) * f, y, A[2] + (B[2] - A[2]) * f); else hx.push(A[0] * .92, y + .02, A[2] * .92); }
      }
      for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) for (let z = 0; z < 7; z++) cu.push((x / 6 * 2 - 1) * .74, (y / 6 * 2 - 1) * .74, (z / 6 * 2 - 1) * .74);
      for (let i = 0; i < N; i++) { const u = (i % 49) / 49 * TAU, v = Math.floor(i / 49) / 7 * TAU, R = .76, r = .3; to.push((R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)); }
      shapes.reason = Float32Array.from(sp); shapes.create = Float32Array.from(hx); shapes.analyze = Float32Array.from(cu); shapes.remember = Float32Array.from(to);
      P.set(shapes.reason);
      for (let i = 0; i < N * 3; i++) P[i] *= .02;
    }
    const active = () => cv && document.body.dataset.skin === 'nebula' && !document.hidden && cv.offsetParent !== null;

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w !== W || h !== H) { W = cv.width = w; H = cv.height = h; }
    }
    function setText(id, t) { const el = document.getElementById(id); if (el && el.textContent !== t) el.textContent = t; }

    function pulseAt(px, py, strength = 1) {
      energy = Math.min(1.4, energy + .9 * strength);
      waves.push({ x: px, y: py, r: 0, a: .9 });
      for (let i = 0; i < N; i++) {
        const k = (.18 + Math.random() * .22) * strength;
        V[i * 3] += P[i * 3] * k; V[i * 3 + 1] += P[i * 3 + 1] * k; V[i * 3 + 2] += P[i * 3 + 2] * k;
      }
      const near = []; for (let i = 0; i < N; i++) near.push([Math.hypot(SX[i] - px, SY[i] - py), i]);
      near.sort((a, b) => a[0] - b[0]);
      for (let n = 0; n < 26 && linkCount; n++) spawnFrom(near[n % 8][1]);
    }
    function spawnFrom(node) {
      for (let tries = 0; tries < 30; tries++) {
        const l = Math.floor(Math.random() * linkCount), a = links[l * 2], b = links[l * 2 + 1];
        if (node == null || a === node || b === node) { pulses.push({ a: node === b ? b : a, b: node === b ? a : b, t: 0, s: .025 + Math.random() * .035, hops: 3 + Math.floor(Math.random() * 4) }); return; }
      }
      const l = Math.floor(Math.random() * linkCount); pulses.push({ a: links[l * 2], b: links[l * 2 + 1], t: 0, s: .03, hops: 2 });
    }
    function nextFrom(node, prev) {
      const cand = [];
      for (let l = 0; l < linkCount && cand.length < 8; l++) {
        const a = links[l * 2], b = links[l * 2 + 1];
        if (a === node && b !== prev) cand.push(b); else if (b === node && a !== prev) cand.push(a);
      }
      return cand.length ? cand[Math.floor(Math.random() * cand.length)] : -1;
    }

    function frame() {
      requestAnimationFrame(frame);
      if (!active()) return;
      resize(); frameN++;
      const T = shapes[mode];
      const ease = .065;
      for (let i = 0; i < N * 3; i++) { P[i] += (T[i] - P[i]) * ease + V[i]; V[i] *= .86; }
      thr += (MODES[mode].link - thr) * .05;
      if (!drag) { const base = reduced ? 0 : .0042 + energy * .01; vy += (base - vy) * .03; }
      ry += vy;
      rx += ((-.32 + tilt) - rx) * .04;
      energy *= .985; if (listenT > 0) listenT--;

      const cx = W / 2, cy = H / 2 + 4 * dpr, R = Math.min(W, H) * .36;
      const cyR = Math.cos(ry), syR = Math.sin(ry), cxR = Math.cos(rx), sxR = Math.sin(rx);
      for (let i = 0; i < N; i++) {
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        const x1 = x * cyR - z * syR, z1 = x * syR + z * cyR;
        const y2 = y * cxR - z1 * sxR, z2 = y * sxR + z1 * cxR;
        const s = 2.8 / (2.8 + z2);
        SX[i] = cx + x1 * R * s; SY[i] = cy + y2 * R * s; SZ[i] = z2; SS[i] = s;
      }
      // links
      const t2 = thr * thr; let lc = 0;
      if (links.length < 6000 * 2) links = new Int16Array(6000 * 2);
      for (let i = 0; i < N && lc < 6000; i++) {
        const xi = P[i * 3], yi = P[i * 3 + 1], zi = P[i * 3 + 2];
        for (let j = i + 1; j < N; j++) {
          const dx = P[j * 3] - xi; if (dx > thr || dx < -thr) continue;
          const dy = P[j * 3 + 1] - yi, dz = P[j * 3 + 2] - zi;
          if (dx * dx + dy * dy + dz * dz < t2) { links[lc * 2] = i; links[lc * 2 + 1] = j; lc++; if (lc >= 6000) break; }
        }
      }
      linkCount = lc;

      ctx.clearRect(0, 0, W, H);
      // core glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
      g.addColorStop(0, `rgba(192,38,211,${.18 + energy * .2})`); g.addColorStop(.45, `rgba(124,58,237,${.08 + energy * .08})`); g.addColorStop(1, 'rgba(124,58,237,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // links in 3 depth buckets
      const cols = ['124,58,237', '168,85,247', '240,171,252'];
      for (let bkt = 0; bkt < 3; bkt++) {
        ctx.beginPath();
        for (let l = 0; l < lc; l++) {
          const a = links[l * 2], b = links[l * 2 + 1]; const z = (SZ[a] + SZ[b]) / 2;
          const k = z > .35 ? 0 : z > -.35 ? 1 : 2; if (k !== bkt) continue;
          ctx.moveTo(SX[a], SY[a]); ctx.lineTo(SX[b], SY[b]);
        }
        ctx.strokeStyle = `rgba(${cols[bkt]},${[.16, .26, .42][bkt] + energy * .25})`;
        ctx.lineWidth = [.6, .8, 1.1][bkt] * dpr; ctx.stroke();
      }
      // neurons
      ctx.globalCompositeOperation = 'lighter';
      const pr = pointer ? 80 * dpr : 0;
      for (let i = 0; i < N; i++) {
        let r = (.8 + SS[i] * 1.3) * dpr, a = .35 + (1 - (SZ[i] + 1) / 2) * .6;
        if (pointer) { const d = Math.hypot(SX[i] - pointer.x, SY[i] - pointer.y); if (d < pr) { const k = 1 - d / pr; r += k * 3 * dpr; a = Math.min(1, a + k); ctx.fillStyle = `rgba(240,171,252,${k * .25})`; ctx.beginPath(); ctx.arc(SX[i], SY[i], r * 3, 0, TAU); ctx.fill(); } }
        ctx.fillStyle = SZ[i] < -.3 ? `rgba(250,232,255,${a})` : SZ[i] < .3 ? `rgba(216,180,254,${a})` : `rgba(139,92,246,${a})`;
        ctx.beginPath(); ctx.arc(SX[i], SY[i], r, 0, TAU); ctx.fill();
      }
      // signals
      const want = (reduced ? 2 : 10) + Math.round(energy * 40) + (listenT > 0 ? 18 : 0);
      while (pulses.length < want && lc) spawnFrom(null);
      const keep = [];
      for (const p of pulses) {
        p.t += p.s * (1 + energy);
        if (p.t >= 1) { if (p.hops > 0) { const n = nextFrom(p.b, p.a); if (n >= 0) { keep.push({ a: p.b, b: n, t: 0, s: p.s, hops: p.hops - 1 }); } } continue; }
        const x = SX[p.a] + (SX[p.b] - SX[p.a]) * p.t, y = SY[p.a] + (SY[p.b] - SY[p.a]) * p.t;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, 7 * dpr);
        rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(.3, 'rgba(244,114,182,.7)'); rg.addColorStop(1, 'rgba(244,114,182,0)');
        ctx.fillStyle = rg; ctx.fillRect(x - 7 * dpr, y - 7 * dpr, 14 * dpr, 14 * dpr);
        keep.push(p);
      }
      pulses = keep.slice(0, 160);
      ctx.globalCompositeOperation = 'source-over';
      // shockwaves
      waves = waves.filter((w) => w.a > .02);
      for (const w of waves) {
        w.r += 7 * dpr; w.a *= .94;
        ctx.strokeStyle = `rgba(240,171,252,${w.a})`; ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke();
      }
      if (frameN % 12 === 0) {
        setText('coreStats', `${N} neurons · ${lc.toLocaleString()} links · ${pulses.length} signals`);
        setText('coreState', listenT > 0 ? 'Listening' : MODES[mode].label);
      }
    }

    function setMode(m) {
      if (!MODES[m]) return;
      mode = m; energy = Math.min(1.4, energy + .5);
      waves.push({ x: W / 2, y: H / 2, r: 0, a: .7 });
      $$('.core-mode').forEach((b) => b.classList.toggle('active', b.dataset.core === m));
      setText('coreThought', MODES[m].thought);
      setText('coreState', MODES[m].label);
    }
    function think() {
      const ms = 18 + Math.floor(Math.random() * 30);
      setText('coreThought', INSIGHTS[insightI++ % INSIGHTS.length](linkCount, ms));
    }
    function init() {
      if (started) return; started = true;
      cv = $('#coreCanvas'); if (!cv) return;
      ctx = cv.getContext('2d'); build();
      const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }; };
      cv.addEventListener('pointermove', (e) => {
        pointer = pos(e);
        const r = cv.getBoundingClientRect(); tilt = ((e.clientY - r.top) / r.height - .5) * .5;
        if (drag) {
          const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
          ry += (e.clientX - drag.lx) * .01; tilt += (e.clientY - drag.ly) * .004; vy = (e.clientX - drag.lx) * .002;
          drag.lx = e.clientX; drag.ly = e.clientY;
        }
      });
      cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ } });
      cv.addEventListener('pointerup', (e) => {
        if (drag && !drag.moved) { const p = pos(e); pulseAt(p.x, p.y); think(); }
        drag = null; $('#coreHint').style.opacity = '0';
      });
      cv.addEventListener('pointerleave', () => { pointer = null; tilt = 0; });
      cv.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pulseAt(W / 2, H / 2); think(); } });
      $$('.core-mode').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.core)));
      $('#coreTry').addEventListener('click', () => send(MODES[mode].prompt));
      requestAnimationFrame(frame);
    }
    function listen() { if (!started) return; listenT = 50; energy = Math.min(1.2, energy + .05); }
    return { init, listen };
  })();

  /* ---------------- Matte: slow red light trails ----------------
     Thin ribbons drift across the lower part of the screen; a red light
     travels along each one with a fading tail, like long-exposure tail-lights. */
  const Trails = (() => {
    const TAU = Math.PI * 2;
    let cv, ctx, W = 0, H = 0, dpr = 1, started = false, t0 = 0;
    const R = [];
    function init() {
      if (started) return; started = true;
      cv = $('#matteTrails'); if (!cv) return; ctx = cv.getContext('2d');
      for (let i = 0; i < 7; i++) {
        const low = true;
        R.push({ by: low ? .62 + i * .05 : .12 + (i - 7) * .08, a1: 18 + Math.random() * 34, f1: .6 + Math.random() * .9, p1: Math.random() * TAU, s1: .05 + Math.random() * .08,
          a2: 6 + Math.random() * 14, f2: 1.6 + Math.random() * 1.6, p2: Math.random() * TAU, s2: .04 + Math.random() * .06,
          alpha: low ? .07 + Math.random() * .09 : .04, speed: .055 + Math.random() * .06, off: Math.random(), w: low ? 1 : .8 });
      }
      t0 = performance.now(); requestAnimationFrame(frame);
    }
    const yAt = (r, x, t) => r.by * H + (r.a1 * Math.sin(x / W * r.f1 * TAU + r.p1 + t * r.s1 * TAU) + r.a2 * Math.sin(x / W * r.f2 * TAU + r.p2 - t * r.s2 * TAU)) * dpr;
    function frame(now) {
      requestAnimationFrame(frame);
      if (document.body.dataset.skin !== 'matte' || document.hidden) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w !== W || h !== H) { W = cv.width = w; H = cv.height = h; }
      const t = reduced ? 0 : (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const step = 8 * dpr;
      for (const r of R) {
        const fade = ctx.createLinearGradient(0, 0, W, 0);
        fade.addColorStop(0, 'rgba(225,29,46,0)'); fade.addColorStop(.25, `rgba(225,29,46,${r.alpha})`); fade.addColorStop(.75, `rgba(225,29,46,${r.alpha})`); fade.addColorStop(1, 'rgba(225,29,46,0)');
        ctx.strokeStyle = fade; ctx.lineWidth = r.w * dpr; ctx.beginPath();
        for (let x = 0; x <= W; x += step) { const y = yAt(r, x, t); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
        if (reduced) continue;
        const u = ((t * r.speed + r.off) % 1.35) - .2, tail = .22;
        const x1 = u * W, x0 = (u - tail) * W;
        const g = ctx.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, 'rgba(255,52,69,0)'); g.addColorStop(1, `rgba(255,70,85,${Math.min(.85, r.alpha * 6)})`);
        ctx.strokeStyle = g; ctx.lineWidth = (r.w + .8) * dpr; ctx.beginPath();
        for (let x = Math.max(0, x0); x <= Math.min(W, x1); x += step / 2) { const y = yAt(r, x, t); x === Math.max(0, x0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
        if (x1 > 0 && x1 < W) {
          const y = yAt(r, x1, t), rad = 14 * dpr;
          const hg = ctx.createRadialGradient(x1, y, 0, x1, y, rad);
          hg.addColorStop(0, `rgba(255,220,224,${Math.min(.9, r.alpha * 7)})`); hg.addColorStop(.25, 'rgba(255,52,69,.45)'); hg.addColorStop(1, 'rgba(255,52,69,0)');
          ctx.fillStyle = hg; ctx.fillRect(x1 - rad, y - rad, rad * 2, rad * 2);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    return { init };
  })();

  /* ---------------- AI client ----------------
     Talks to /api/chat (a Vercel function) and streams the reply. When the
     page is opened without the backend (a local file or a preview), the
     built-in sample replies are used instead. */
  const AI = { backend: null, ctrl: null, key: null, checked: false };
  const LOCAL_PROVIDERS = ['lmstudio', 'ollama'];

  async function checkBackend() {
    if (!/^https?:$/.test(location.protocol)) { AI.checked = true; paintModel(); return; }
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 6000);
      const r = await fetch('/api/health', { signal: c.signal, cache: 'no-store' }); clearTimeout(t);
      const j = r.ok ? await r.json() : null;
      if (j && j.ok) { AI.backend = j; log(`AI online · ${j.provider} · ${j.model}`); }
    } catch { /* backend not available here */ }
    AI.checked = true; paintModel();
  }
  const ownModelActive = () => !!(state.model && state.choice !== 'Auto' && (LOCAL_PROVIDERS.includes(state.model.providerId) ? state.model.baseUrl : AI.key));
  const usingLocal = () => ownModelActive() && LOCAL_PROVIDERS.includes(state.model.providerId);
  const aiAvailable = () => !!AI.backend || usingLocal();

  function buildSystem() {
    const P = state.prefs || {}; const brand = state.brand.name;
    const lines = [
      `You are ${brand}, an AI assistant inside the ${brand} workspace app. Today is ${new Date().toDateString()}.`,
      'Be accurate, practical and friendly. Format answers in Markdown: short paragraphs, lists and tables where they help.',
      'When asked to write code, give complete, working code in fenced code blocks with a language tag (```html, ```python, ```javascript, ```php, ```sql …). For a web page or UI, put everything in ONE ```html block with inline CSS and JavaScript so it can be previewed. After the code, explain briefly how to use it.',
      `Response mode: ${state.mode}.${state.mode === 'Plan' ? ' Outline the plan as numbered steps before doing the work.' : state.mode === 'Quick' ? ' Keep the answer short.' : ''}`,
      `Style: ${P.tone || 'Balanced'}.`,
    ];
    if (P.replyLanguage && P.replyLanguage !== 'Match my message') lines.push(`Always reply in ${P.replyLanguage}.`); else lines.push("Reply in the language of the user's message.");
    if (P.displayName) lines.push(`The user's name is ${P.displayName}.`);
    if (P.instructions) lines.push(`User's custom instructions:\n${P.instructions}`);
    const ws = state.workspace;
    if (ws && ws.files && ws.files.length) lines.push(`The user opened a workspace folder "${ws.name}" with ${ws.files.length} files, including:\n${ws.files.slice(0, 80).map((f) => `- ${f.name} (${f.size})`).join('\n')}`);
    lines.push('This app turns your replies into downloadable PDF and Word files, and generates images itself. When the user asks for a document, report, letter, contract, proposal, PDF or Word file, write the COMPLETE document in Markdown, starting with a "# Title" line, using headings, lists and tables; the app adds Download PDF and Download Word buttons. Never say you cannot create files or PDFs.');
    lines.push('When asked about a person, share what reliable public sources say, focusing on public figures and professional information. Do not compile or guess private details about private individuals (home address, phone number, family members, ID numbers, location); suggest official or professional channels instead.');
    if (AI.webContext) lines.push(AI.webContext);
    else lines.push('No web results are attached to this message. For recent events or people you are unsure about, say your knowledge may be out of date and that the user can ask you to "search" or "look up" the topic.');
    const role = window.GASPro && window.GASPro.system();
    if (role) lines.push(role);
    return lines.join('\n\n');
  }

  const htmlToText = (h) => String(h || '').replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|li|h\d|div|tr)>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();

  function historyFor(c) {
    return c.messages.map((m) => {
      if (m.role === 'user') {
        let content = m.text;
        (m.attach || []).forEach((a) => { content += a.text ? `\n\nAttached file "${a.name}":\n\`\`\`\n${a.text}\n\`\`\`` : `\n\n[Attached file: ${a.name}]`; });
        if (!m.attach && m.files && m.files.length) content += `\n\n[Attached files: ${m.files.join(', ')}]`;
        return { role: 'user', content };
      }
      return { role: 'assistant', content: m.text || htmlToText(m.html) };
    }).filter((m) => m.content);
  }

  // Parses an OpenAI-style SSE stream into a text stream (used for local LM Studio / Ollama).
  function sseText(res) {
    const reader = res.body.getReader(); const dec = new TextDecoder(); const enc = new TextEncoder(); let buf = '';
    return new ReadableStream({
      async pull(ctrl) {
        for (;;) {
          const nl = buf.indexOf('\n');
          if (nl >= 0) {
            const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
            if (!line.startsWith('data:')) continue;
            const d = line.slice(5).trim(); if (d === '[DONE]') { ctrl.close(); return; }
            try { const t = JSON.parse(d).choices?.[0]?.delta?.content; if (t) { ctrl.enqueue(enc.encode(t)); return; } } catch { /* skip */ }
            continue;
          }
          const { done, value } = await reader.read(); if (done) { ctrl.close(); return; }
          buf += dec.decode(value, { stream: true });
        }
      },
      cancel() { reader.cancel().catch(() => {}); },
    });
  }

  async function openStream(c, signal) {
    const messages = historyFor(c); const system = buildSystem();
    if (usingLocal()) {
      let base = state.model.baseUrl.replace(/\/+$/, ''); if (state.model.providerId === 'ollama' && !/\/v1$/.test(base)) base += '/v1';
      const r = await fetch(`${base}/chat/completions`, { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: state.model.model, stream: true, messages: [{ role: 'system', content: system }, ...messages] }) });
      if (!r.ok) throw new Error(`${state.model.provider} returned ${r.status}. Check that the server is running and allows this site (CORS).`);
      return (r.headers.get('content-type') || '').includes('event-stream') ? sseText(r) : new Response(JSON.parse(await r.text()).choices?.[0]?.message?.content || '').body;
    }
    const override = ownModelActive() && !usingLocal() ? { provider: state.model.providerId, apiKey: AI.key, model: state.model.model } : undefined;
    const r = await fetch('/api/chat', { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages, system, override }) });
    if (!r.ok) { let msg = `The AI service returned ${r.status}.`; try { msg = (await r.json()).error || msg; } catch { /* not json */ } throw new Error(msg); }
    return r.body;
  }

  /* Markdown → HTML (escape first, then format) */
  const CODE_EXT = { html: 'html', htm: 'html', xml: 'xml', svg: 'svg', css: 'css', scss: 'scss', js: 'js', javascript: 'js', jsx: 'jsx', ts: 'ts', typescript: 'ts', tsx: 'tsx', json: 'json', python: 'py', py: 'py', php: 'php', java: 'java', kotlin: 'kt', swift: 'swift', c: 'c', cpp: 'cpp', 'c++': 'cpp', csharp: 'cs', cs: 'cs', go: 'go', rust: 'rs', ruby: 'rb', sql: 'sql', bash: 'sh', sh: 'sh', shell: 'sh', powershell: 'ps1', yaml: 'yml', yml: 'yml', markdown: 'md', md: 'md', dockerfile: 'Dockerfile', vue: 'vue', dart: 'dart' };
  function inl(t) {
    const codes = [];
    t = t.replace(/`([^`\n]+)`/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    t = esc(t)
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?=[^*\w]|$)/g, '$1<em>$2</em>')
      .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return t.replace(/\u0000(\d+)\u0000/g, (m, n) => `<code>${esc(codes[+n])}</code>`);
  }
  function codeBlockHTML(code, lang, closed) {
    const l = (lang || '').toLowerCase(); const canPreview = l === 'html' || l === 'htm' || l === 'svg';
    const lines = code.split('\n').length;
    return `<div class="code-block${closed ? '' : ' writing'}" data-lang="${esc(l)}">
      <div class="cb-head"><span class="cb-lang">${icon('code')}${esc(l || 'text')}<small>${lines} line${lines === 1 ? '' : 's'}</small></span>
      <span class="cb-actions">${canPreview ? `<button type="button" data-cb="preview">${icon('play')}Preview</button>` : ''}<button type="button" data-cb="copy">${icon('copy')}Copy</button><button type="button" data-cb="download">${icon('download')}Download</button></span></div>
      <pre><code class="${l ? 'language-' + esc(l) : ''}">${esc(code)}</code></pre></div>`;
  }
  function md(src) {
    const L = String(src || '').replace(/\r/g, '').split('\n'); let i = 0, out = '';
    const isBlockStart = (s) => /^```/.test(s) || /^#{1,6}\s/.test(s) || /^\s*>/.test(s) || /^\s*([-*+]|\d+[.)])\s+/.test(s) || /^\s*([-*_])(\s*\1){2,}\s*$/.test(s);
    while (i < L.length) {
      const line = L[i];
      const fence = /^```\s*([\w+#.-]*)/.exec(line);
      if (fence) {
        const buf = []; i++;
        while (i < L.length && !/^```\s*$/.test(L[i])) buf.push(L[i++]);
        const closed = i < L.length; i++;
        out += codeBlockHTML(buf.join('\n'), fence[1], closed); continue;
      }
      if (!line.trim()) { i++; continue; }
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) { const lv = Math.min(6, h[1].length + 2); out += `<h${lv}>${inl(h[2])}</h${lv}>`; i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out += '<hr>'; i++; continue; }
      if (/^\s*>/.test(line)) { const q = []; while (i < L.length && /^\s*>/.test(L[i])) q.push(L[i++].replace(/^\s*>\s?/, '')); out += `<blockquote>${q.map(inl).join('<br>')}</blockquote>`; continue; }
      if (line.includes('|') && i + 1 < L.length && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(L[i + 1])) {
        const cells = (s) => s.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const head = cells(line); i += 2; const rows = [];
        while (i < L.length && L[i].includes('|') && L[i].trim()) rows.push(cells(L[i++]));
        out += `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head.map((c) => `<th>${inl(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inl(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        continue;
      }
      const li = /^\s*([-*+]|\d+[.)])\s+/.exec(line);
      if (li) {
        const ordered = /\d/.test(li[1]); const items = [];
        while (i < L.length) {
          const m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(L[i]);
          if (m) { items.push(m[2]); i++; continue; }
          if (L[i].trim() && /^\s{2,}/.test(L[i]) && items.length) { items[items.length - 1] += ' ' + L[i].trim(); i++; continue; }
          break;
        }
        out += `<${ordered ? 'ol' : 'ul'}>${items.map((t) => `<li>${inl(t.replace(/^\[( |x)\]\s*/i, (m, x) => (x.trim() ? '☑ ' : '☐ ')))}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`;
        continue;
      }
      const para = [line]; i++;
      while (i < L.length && L[i].trim() && !isBlockStart(L[i]) && !(L[i].includes('|') && i + 1 < L.length && /^\s*\|?\s*:?-{3,}/.test(L[i + 1]))) para.push(L[i++]);
      out += `<p>${para.map(inl).join('<br>')}</p>`;
    }
    return out;
  }
  function highlight(root) {
    if (!window.hljs) return;
    $$('pre code[class*="language-"]', root).forEach((el) => {
      if (el.dataset.hl) return; const lang = (el.className.match(/language-([\w+#.-]+)/) || [])[1];
      if (lang && window.hljs.getLanguage(lang)) { try { window.hljs.highlightElement(el); el.dataset.hl = '1'; } catch { /* leave plain */ } }
    });
  }

  function codeArtifacts(text, title) {
    const re = /```\s*([\w+#.-]*)\n([\s\S]*?)```/g; let m, n = 0;
    while ((m = re.exec(text))) {
      const lang = (m[1] || 'txt').toLowerCase(); const code = m[2]; const lines = code.split('\n').length;
      if (lines < 6 || code.length > 60000) continue;
      const ext = CODE_EXT[lang] || 'txt'; n++;
      const base = title.replace(/[^\w\- ]+/g, '').trim().slice(0, 32) || 'Code';
      const name = `${base}${n > 1 ? ' ' + n : ''}.${ext}`;
      state.artifacts = state.artifacts.filter((a) => a.name !== name);
      state.artifacts.unshift({ name, kind: 'code', lang, meta: `${lang.toUpperCase()} · ${lines} lines`, time: now(), code, gen: true });
      log(`Saved ${name} to Artifacts`);
    }
  }

  function openCode(code, lang, name, mode) {
    const l = (lang || '').toLowerCase(); const canPreview = l === 'html' || l === 'htm' || l === 'svg';
    const show = mode || (canPreview ? 'preview' : 'code');
    $('#lb-h').textContent = name || `${l || 'Code'} snippet`;
    $('#lbMeta').textContent = `${(l || 'text').toUpperCase()} · ${code.split('\n').length} lines${show === 'preview' ? ' · live preview (sandboxed)' : ''}`;
    const stage = $('#lbStage');
    if (show === 'preview') {
      const f = document.createElement('iframe'); f.className = 'code-preview'; f.title = 'Code preview';
      f.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups');
      f.srcdoc = l === 'svg' ? `<!doctype html><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#fff">${code}</body>` : code;
      stage.replaceChildren(f);
    } else {
      stage.innerHTML = `<pre class="code-view"><code class="${l ? 'language-' + esc(l) : ''}">${esc(code)}</code></pre>`; highlight(stage);
    }
    const acts = $('#lbActions'); acts.innerHTML = '';
    const mk = (label, ico, fn, primary) => { const b = document.createElement('button'); b.type = 'button'; b.className = primary ? 'btn-primary' : 'btn-ghost'; b.innerHTML = icon(ico) + esc(label); b.onclick = fn; acts.append(b); };
    if (canPreview) mk(show === 'preview' ? 'View code' : 'Preview', show === 'preview' ? 'code' : 'play', () => openCode(code, l, name, show === 'preview' ? 'code' : 'preview'));
    mk('Copy', 'copy', () => copy(code, 'Code copied'));
    mk('Download', 'download', () => downloadText(code, name || `code.${CODE_EXT[l] || 'txt'}`), true);
    if ($('#lightbox').hidden) openModal('lightbox');
  }
  function downloadText(text, name) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000); toast(`Downloading ${name}`, 'download');
    } catch { toast('Download was blocked by the browser.', 'x'); }
  }
  function codeAction(btn) {
    const block = btn.closest('.code-block'); const code = $('code', block).textContent; const lang = block.dataset.lang;
    const name = `snippet.${CODE_EXT[lang] || 'txt'}`;
    if (btn.dataset.cb === 'copy') copy(code, 'Code copied');
    else if (btn.dataset.cb === 'download') downloadText(code, name);
    else openCode(code, lang, name, 'preview');
  }

  function setStreaming(on) {
    const b = $('#sendBtn');
    b.classList.toggle('stop', on); b.disabled = false;
    b.setAttribute('aria-label', on ? 'Stop generating' : 'Send message');
    b.innerHTML = icon(on ? 'stop' : 'up');
  }

  async function streamReply(holder, c, title, extra = {}) {
    const body = $('.body', holder);
    AI.ctrl = new AbortController(); setStreaming(true);
    let out = '', error = '', stopped = false, raf = 0;
    const paint = () => { raf = 0; body.innerHTML = md(out) + '<span class="caret"></span>'; scrollDown(true); };
    try {
      const stream = await openStream(c, AI.ctrl.signal);
      const reader = stream.getReader(); const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        out += dec.decode(value, { stream: true });
        if (!raf) raf = requestAnimationFrame(paint);
      }
    } catch (e) {
      if (e.name === 'AbortError') stopped = true; else error = e.message || 'Something went wrong.';
    }
    if (raf) cancelAnimationFrame(raf);
    AI.ctrl = null; setStreaming(false);
    let html = md(out);
    if (stopped) html += '<p class="note">Stopped.</p>';
    if (error) html += `<div class="ai-error">${icon('x')}<span>${esc(error)}</span><button type="button" class="mini-btn" data-retry="1">${icon('right')}Try again</button></div>`;
    if (!out && !error && !stopped) html = '<p class="note">The model returned an empty reply. Try rephrasing your message.</p>';
    body.innerHTML = html; highlight(body); scrollDown(true);
    if (out) {
      const m = { role: 'ai', text: out, html: md(out) };
      if (extra.sources && extra.sources.length) m.sources = extra.sources;
      if (extra.doc && !error && !stopped) { m.doc = { title: window.GASDocs ? window.GASDocs.titleOf(out, title) : title }; saveDocArtifact(out, m.doc.title); }
      c.messages.push(m);
      decorateAI(holder, m); scrollDown(true);
      codeArtifacts(out, title);
    }
    return { out, error };
  }

  function retryLast() {
    const c = current(); if (!c) return;
    while (c.messages.length && c.messages[c.messages.length - 1].role === 'ai') c.messages.pop();
    const last = c.messages.pop(); if (!last) return;
    renderThread(); send(last.text, last.attach);
  }

  /* ---------------- Greeting ---------------- */
  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }
  function paintGreeting() {
    const name = ((state.prefs && state.prefs.displayName) || '').trim().split(/\s+/)[0];
    const g = greeting() + (name ? `, ${name}` : '');
    const el = $('#greetText');
    el.textContent = g; el.dataset.text = g;
  }

  /* ---------------- Router: launcher <-> skins ---------------- */
  let bootedCyber = false;
  function route() {
    const h = location.hash.replace('#', '');
    closeAllOverlays();
    // The Pro workspace is the default page; the studio launcher lives at #studio.
    if (h === 'studio') openLauncher(); else openSkin(SKINS[h] ? h : 'pro');
  }
  function openLauncher() {
    state.skin = null;
    document.body.dataset.skin = 'home';
    document.body.classList.remove('in-app');
    $('#app').hidden = true;
    $('#launcher').hidden = false;
    applyBrand();
    stopClock();
  }
  function openSkin(id) {
    const changed = state.skin !== id;
    state.skin = id;
    store.set('skin', id);
    document.body.dataset.skin = id;
    document.body.classList.add('in-app');
    $('#launcher').hidden = true;
    const app = $('#app');
    app.hidden = false;
    if (changed) { app.style.animation = 'none'; void app.offsetWidth; app.style.animation = ''; }
    applyBrand();
    paintGreeting();
    $('#skinSw').className = 'sw sw-' + id;
    $('#skinName').textContent = SKINS[id].name;
    if (changed) log(`Switched to ${SKINS[id].name} interface`);
    if (id === 'nebula') Core.init();
    if (id === 'matte') Trails.init();
    if (id === 'cyber') { startClock(); if (!bootedCyber) { bootedCyber = true; boot(); } } else stopClock();
    paintModel();
    if (window.GASPro) window.GASPro.onView();
  }

  /* Cyber boot sequence */
  async function boot() {
    if (reduced) return;
    const el = $('#boot'); const pre = $('#bootLog');
    el.hidden = false; pre.textContent = '';
    const lines = [
      `${state.brand.name.toUpperCase()} // SECURE CONSOLE`,
      '> verifying local runtime ........ OK',
      '> sandbox policy: workspace-only .. OK',
      '> channel encryption: AES-256 ..... OK',
      `> model link: ${AI.backend ? AI.backend.provider.toUpperCase() + ' ..... ONLINE' : 'checking ........ STANDBY'}`,
      '> session ready.',
    ];
    for (const l of lines) { pre.textContent += l + '\n'; await sleep(150); }
    await sleep(250);
    el.hidden = true;
  }

  let clockT = null;
  function startClock() {
    const tick = () => {
      const d = new Date();
      $('#stClock').textContent = d.toISOString().slice(11, 19) + ' UTC';
      $('#stLatency').textContent = `Latency ${18 + Math.round(Math.random() * 14)} ms`;
    };
    tick(); stopClock(); clockT = setInterval(tick, 1000);
  }
  function stopClock() { if (clockT) clearInterval(clockT); clockT = null; }

  /* ---------------- Sidebar & sections ---------------- */
  function relTime(t) {
    const s = Math.max(0, (now() - t) / 1000);
    if (s < 90) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  }
  const projectById = (id) => (state.projects || []).find((p) => p.id === id);
  function recentRow(c) {
    const proj = c.projectId && projectById(c.projectId);
    const active = c.id === state.current && state.section === 'chat';
    return `<div class="recent-row${active ? ' active' : ''}" data-row="${c.id}">
      <button class="recent${active ? ' active' : ''}" data-convo="${c.id}"><b>${c.pinned ? icon('pin', 'pin-ico') : ''}${esc(c.title)}</b><small>${relTime(c.updated)}${proj ? ` · ${esc(proj.title)}` : ''}</small></button>
      <button class="recent-more" data-convo-menu="${c.id}" aria-label="Options for ${esc(c.title)}" aria-haspopup="menu" title="Pin, move, archive or delete">${icon('more')}</button>
    </div>`;
  }
  function renderRecents() {
    const q = $('#recentSearch').value.trim().toLowerCase();
    const match = (c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => (m.text || '').toLowerCase().includes(q));
    const sorted = state.convos.slice().sort((a, b) => b.updated - a.updated);
    const archivedCount = sorted.filter((c) => c.archived).length;
    if (state.showArchived && !archivedCount) state.showArchived = false;
    let html = '';
    if (state.showArchived) {
      const list = sorted.filter((c) => c.archived && match(c));
      html = `<button class="recents-back" data-action="hide-archived">${icon('left')}<span>Archived chats</span><small>${archivedCount}</small></button>`
        + (list.length ? list.map(recentRow).join('') : '<p class="recents-empty">No archived chats match that search.</p>');
    } else {
      const live = sorted.filter((c) => !c.archived && match(c));
      const pinned = live.filter((c) => c.pinned), rest = live.filter((c) => !c.pinned);
      if (pinned.length) html += `<p class="recents-group">${icon('pin')}Pinned</p>` + pinned.map(recentRow).join('');
      if (pinned.length && rest.length) html += '<p class="recents-group">Recent</p>';
      html += rest.map(recentRow).join('');
      if (!live.length) html = `<p class="recents-empty">${q ? 'No chats match that search.' : 'Your chats will show up here.'}</p>`;
      if (archivedCount) html += `<button class="recents-archived" data-action="show-archived">${icon('archive')}<span>Archived</span><small>${archivedCount}</small></button>`;
    }
    $('#recents').innerHTML = html;
    $('#artifactCount').textContent = state.artifacts.length || '';
    proView();
  }

  /* Conversation actions: pin, move to project, archive, delete */
  const convo = (id) => state.convos.find((c) => c.id === id);
  function afterConvoChange() { save(); renderRecents(); if (state.section === 'projects') renderSection('projects'); }
  function leaveIfOpen(id) { if (state.current === id) newChat(); }
  function convoMenu(btn) {
    const c = convo(btn.dataset.convoMenu); if (!c) return;
    const proj = c.projectId && projectById(c.projectId);
    const main = () => c.archived
      ? `<p class="pop-title">${esc(c.title)}</p>
         <button class="pop-item" data-pick="unarchive">${icon('archive')}<span><b>Unarchive</b><small>Move back to Recents</small></span></button>
         <div class="pop-sep"></div>
         <button class="pop-item danger" data-pick="delete">${icon('trash')}<span><b>Delete</b><small>Remove this chat for good</small></span></button>`
      : `<p class="pop-title">${esc(c.title)}</p>
         <button class="pop-item" data-pick="pin">${icon('pin')}<span><b>${c.pinned ? 'Unpin' : 'Pin'}</b><small>${c.pinned ? 'Return to the Recent list' : 'Keep it at the top of Recents'}</small></span></button>
         <button class="pop-item" data-pick="move">${icon('move')}<span><b>Move to project</b><small>${proj ? `In ${esc(proj.title)}` : 'Group it with related work'}</small></span>${icon('right', 'chk')}</button>
         <button class="pop-item" data-pick="archive">${icon('archive')}<span><b>Archive</b><small>Hide from Recents, keep the history</small></span></button>
         <div class="pop-sep"></div>
         <button class="pop-item danger" data-pick="delete">${icon('trash')}<span><b>Delete</b><small>Remove this chat for good</small></span></button>`;
    const moveHTML = () => `<button class="pop-item pop-back" data-pick="back">${icon('left')}<span><b>Move to project</b></span></button><div class="pop-sep"></div>`
      + state.projects.map((p) => `<button class="pop-item" data-pick="to:${p.id}">${icon('folder')}<span><b>${esc(p.title)}</b></span>${c.projectId === p.id ? icon('check', 'chk') : ''}</button>`).join('')
      + `<button class="pop-item" data-pick="newproj">${icon('plus')}<span><b>New project</b><small>Create one and move this chat into it</small></span></button>`
      + (c.projectId ? `<div class="pop-sep"></div><button class="pop-item" data-pick="noproj">${icon('x')}<span><b>Remove from project</b></span></button>` : '');
    const confirmHTML = () => `<div class="pop-confirm"><b>Delete “${esc(c.title)}”?</b><small>The chat and its messages are removed from this browser. This can't be undone.</small>
      <div class="pop-confirm-actions"><button class="btn-ghost" data-pick="cancel">Cancel</button><button class="btn-danger" data-pick="confirm-delete">${icon('trash')}Delete</button></div></div>`;
    const pop = $('#popover');
    const swap = (html) => { pop.innerHTML = html; const f = $('[data-pick]', pop); f && f.focus(); return 'keep'; };
    popover(btn, main(), (v) => {
      if (v === 'cancel') return undefined;
      if (v === 'back') return swap(main());
      if (v === 'move') return swap(moveHTML());
      if (v === 'delete') return swap(confirmHTML());
      if (v === 'pin') { c.pinned = !c.pinned; toast(c.pinned ? 'Chat pinned' : 'Chat unpinned', 'pin'); log(`${c.pinned ? 'Pinned' : 'Unpinned'} "${c.title}"`); }
      else if (v.startsWith('to:')) { const p = projectById(v.slice(3)); c.projectId = p.id; toast(`Moved to ${p.title}`, 'move'); log(`Moved "${c.title}" to ${p.title}`); }
      else if (v === 'newproj') { const p = addProject(true); c.projectId = p.id; toast(`Moved to ${p.title}`, 'move'); log(`Moved "${c.title}" to new project ${p.title}`); }
      else if (v === 'noproj') { c.projectId = null; toast('Removed from project', 'move'); }
      else if (v === 'archive') {
        c.archived = true; c.pinned = false; leaveIfOpen(c.id); log(`Archived "${c.title}"`);
        toast('Chat archived', 'archive', { label: 'Undo', run: () => { c.archived = false; afterConvoChange(); } });
      } else if (v === 'unarchive') { c.archived = false; toast('Chat restored to Recents', 'archive'); log(`Unarchived "${c.title}"`); }
      else if (v === 'confirm-delete') {
        const idx = state.convos.indexOf(c); state.convos.splice(idx, 1); leaveIfOpen(c.id); log(`Deleted "${c.title}"`);
        toast('Chat deleted', 'trash', { label: 'Undo', run: () => { state.convos.splice(idx, 0, c); afterConvoChange(); } });
      }
      afterConvoChange();
    });
  }

  const SECTIONS = {
    code: { title: 'Code', sub: 'Workspace · Code', icon: 'code', desc: 'Open a folder and the agent can read, edit and run code with you. It asks before changing files unless Auto-approve is on.', action: 'Open a folder', run: () => pickFolder(),
      items: () => (state.workspace.files
        ? [{ ico: 'folder', c: 'c1', title: state.workspace.name, text: `${state.workspace.files.length} files loaded from your computer`, foot: 'Open now', pill: ['on', 'Active'] }]
        : []).concat([
        { ico: 'code', c: 'c1', title: 'web-dashboard', text: 'TypeScript · 214 files · branch main', foot: 'Edited 2 h ago', pill: ['on', 'Clean'] },
        { ico: 'code', c: 'c2', title: 'data-pipeline', text: 'Python · 88 files · 3 failing tests', foot: 'Edited yesterday', pill: ['risk', '3 failing'] },
        { ico: 'code', c: 'c3', title: 'marketing-site', text: 'Astro · 61 files · branch redesign', foot: 'Edited 4 days ago', pill: ['idle', 'Idle'] },
      ]) },
    projects: { title: 'Projects', sub: 'Workspace · Projects', icon: 'folder', desc: 'Group chats, files and instructions so the agent keeps context for a piece of work.', action: 'New project', run: () => addProject(),
      items: () => state.projects.map((p) => {
        const chats = state.convos.filter((c) => c.projectId === p.id && !c.archived);
        return Object.assign({}, p, chats.length ? { text: `${p.text} · moved here: ${chats.map((c) => c.title).slice(0, 3).join(', ')}${chats.length > 3 ? '…' : ''}`, pill: ['on', `${chats.length} chat${chats.length > 1 ? 's' : ''}`] } : {});
      }) },
    artifacts: { title: 'Artifacts', sub: 'Workspace · Artifacts', icon: 'grid', desc: 'Documents, spreadsheets, PDFs and images the agent has created. New files from chat appear here.', action: 'Create in chat', run: () => newChat(),
      items: () => state.artifacts.map((a) => ({ code: a.code, lang: a.lang, doc: a.doc, name: a.name, ico: { docx: 'file', xlsx: 'sheet', pdf: 'file', png: 'image', webm: 'video', code: 'code' }[a.kind] || 'file', c: { docx: 'c1', xlsx: 'c2', pdf: 'c4', png: 'c3', webm: 'c4' }[a.kind], title: a.name, text: a.meta, foot: relTime(a.time), id: a.name, media: a.media })) },
    scheduled: { title: 'Scheduled', sub: 'Workspace · Scheduled', icon: 'clock', desc: 'Tasks the agent runs on a timetable, like a morning inbox digest or a Friday report.', action: 'New schedule', run: () => addSchedule(),
      items: () => state.schedules },
    team: { title: 'Team room', sub: 'Workspace · Team room', icon: 'users', desc: 'Share chats and agents with teammates. Everyone sees the same files and history.', action: 'Copy invite link', run: () => copy(location.href.split('#')[0] + '#' + (state.skin || 'glass'), 'Invite link copied'),
      items: () => [
        { ico: 'users', c: 'c1', title: 'Design review', text: 'Shared thread · 14 messages', foot: 'Active 5 min ago', avatars: [['AM', '#7c5cff'], ['JR', '#12a36a'], ['SK', '#e5484d']] },
        { ico: 'users', c: 'c2', title: 'Ops handbook', text: 'Shared project · 6 files', foot: 'Active today', avatars: [['LN', '#2f6bff'], ['AM', '#7c5cff']] },
        { ico: 'users', c: 'c4', title: 'Customer replies', text: 'Shared agent · drafts only', foot: 'Active yesterday', avatars: [['JR', '#12a36a'], ['TP', '#f59e0b'], ['SK', '#e5484d'], ['+2', '#64748b']] },
      ] },
    agents: { title: 'Agents', sub: 'Workspace · Agents', icon: 'radio', desc: 'Specialised agents with their own instructions and tools. Turn them on to make them available in chat.', action: 'New agent', run: () => addAgent(),
      items: () => state.agents },
  };
  state.projects = store.get('projects', null) || [
    { id: 'p-q4', ico: 'folder', c: 'c3', title: 'Q4 planning', text: '12 chats · 8 files · goals, budget and hiring', foot: 'Updated today' },
    { id: 'p-onboard', ico: 'folder', c: 'c1', title: 'Client onboarding', text: '5 chats · 14 files · templates and checklists', foot: 'Updated 2 days ago' },
    { id: 'p-research', ico: 'folder', c: 'c2', title: 'Research notes', text: '9 chats · 22 files · market and competitor notes', foot: 'Updated last week' },
  ];
  state.schedules = [
    { ico: 'clock', c: 'c2', title: 'Morning inbox digest', text: 'Weekdays at 08:00 · summarises unread mail', foot: 'Next run tomorrow 08:00', toggle: true, on: true },
    { ico: 'clock', c: 'c3', title: 'Weekly status report', text: 'Fridays at 16:00 · saves a Word document', foot: 'Next run Friday 16:00', toggle: true, on: true },
    { ico: 'clock', c: 'c4', title: 'Workspace clean-up', text: 'First of the month · archives old drafts', foot: 'Paused', toggle: true, on: false },
  ];
  state.agents = [
    { ico: 'spark', c: 'c1', title: 'Assistant', text: 'General · chats, files and documents', foot: 'Default agent', toggle: true, on: true },
    { ico: 'search', c: 'c2', title: 'Researcher', text: 'Reads sources and writes cited briefs', foot: 'Web + files', toggle: true, on: true },
    { ico: 'code', c: 'c3', title: 'Coder', text: 'Edits and tests code in an open folder', foot: 'Folder access', toggle: true, on: false },
    { ico: 'shield', c: 'c4', title: 'Reviewer', text: 'Checks documents for risks before sending', foot: 'Read-only', toggle: true, on: false },
  ];

  function showSection(id) {
    state.section = id;
    const isChat = id === 'chat';
    $('#chatView').hidden = !isChat;
    $('#sectionView').hidden = isChat;
    $$('.nav [data-section]').forEach((b) => b.classList.toggle('active', b.dataset.section === id));
    if (isChat) { $('#viewTitle').textContent = 'Assistant'; $('#viewSub').textContent = 'General · AI'; }
    else renderSection(id);
    renderRecents();
    closeNav();
  }
  const proView = () => { if (window.GASPro) window.GASPro.onView(); };

  function renderSection(id, flash) {
    const s = SECTIONS[id];
    $('#viewTitle').textContent = s.title;
    $('#viewSub').textContent = s.sub;
    const items = s.items();
    const cards = items.map((it, i) => {
      const tag = it.toggle ? 'div' : 'button';
      return `<${tag} class="card${flash && it.id === flash ? ' flash' : ''}" style="animation-delay:${i * 40}ms" data-card="${i}">
        ${it.media ? `<div class="card-thumb" data-thumb="${esc(JSON.stringify(it.media))}">${it.media.kind === 'video' ? '<span class="pl-badge">▶ 0:06</span>' : ''}</div>` : ''}
        <div class="card-top"><span class="card-ico ${it.c || 'c1'}">${icon(it.ico)}</span><h3>${esc(it.title)}</h3></div>
        <p>${esc(it.text)}</p>
        <div class="card-foot"><span>${esc(it.foot || '')}</span>
          ${it.pill ? `<span class="pill ${it.pill[0]}">${esc(it.pill[1])}</span>` : ''}
          ${it.toggle ? `<button class="switch" role="switch" aria-checked="${!!it.on}" aria-label="Turn ${esc(it.title)} ${it.on ? 'off' : 'on'}" data-toggle="${i}"></button>` : ''}
          ${it.avatars ? `<span class="avatars">${it.avatars.map(([n, c]) => `<span style="background:${c}">${n}</span>`).join('')}</span>` : ''}
        </div>
      </${tag}>`;
    }).join('');
    $('#sectionInner').innerHTML = `
      <div class="sec-head">
        <span class="sec-ico">${icon(s.icon)}</span>
        <div class="sec-title"><h1>${s.title}</h1><p>${esc(s.desc)}</p>
          <div class="sec-meta"><span class="sample-tag">Sample data</span><span>${items.length} item${items.length === 1 ? '' : 's'}</span></div></div>
        <button class="btn-primary" data-sec-action>${icon('plus')}${esc(s.action)}</button>
      </div>
      <div class="cards">${cards || '<p class="note">Nothing here yet.</p>'}</div>`;
    $('#sectionInner [data-sec-action]').onclick = s.run;
    $$('#sectionInner [data-thumb]').forEach((el) => {
      try { const m = JSON.parse(el.dataset.thumb); el.prepend(canvasFor(m, 480, 270, .25)); } catch { /* bad thumb spec */ }
    });
    $$('#sectionInner [data-toggle]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const it = items[+b.dataset.toggle]; it.on = !it.on;
      b.setAttribute('aria-checked', it.on);
      toast(`${it.title} turned ${it.on ? 'on' : 'off'}`);
      log(`${it.title} ${it.on ? 'enabled' : 'disabled'}`);
    }));
    $$('#sectionInner button.card').forEach((c) => c.addEventListener('click', () => {
      const it = items[+c.dataset.card];
      if (id === 'artifacts') { if (it.media) openLightbox(it.media); else if (it.doc) openDoc(it); else if (it.code) openCode(it.code, it.lang, it.title); else toast(`${it.title} is a sample file. Ask in chat for a document and you can download it as PDF or Word.`, 'file'); }
      else if (id === 'projects' || id === 'team') { newChat(); $('#prompt').value = `Let's continue with "${it.title}". `; autosize(); $('#prompt').focus(); }
      else if (id === 'code') { newChat(); $('#prompt').value = `In ${it.title}, `; autosize(); $('#prompt').focus(); }
    }));
  }

  function addProject(silent) {
    const n = state.projects.length + 1;
    const p = { id: 'p-' + now().toString(36), ico: 'folder', c: ['c1', 'c2', 'c3', 'c4'][n % 4], title: `New project ${n}`, text: 'Add instructions and files to start', foot: 'Created just now' };
    state.projects.unshift(p); save();
    if (!silent) { renderSection('projects'); toast('Project created'); log(`Created project "${p.title}"`); }
    return p;
  }
  function addSchedule() {
    state.schedules.unshift({ ico: 'clock', c: 'c1', title: 'Daily priorities check-in', text: 'Weekdays at 09:30 · asks what matters today', foot: 'Next run tomorrow 09:30', toggle: true, on: true });
    renderSection('scheduled'); toast('Schedule added'); log('Added schedule "Daily priorities check-in"');
  }
  function addAgent() {
    const n = state.agents.length - 3;
    state.agents.push({ ico: 'cpu', c: 'c2', title: `Custom agent ${n}`, text: 'Describe what it should do in Settings', foot: 'Draft', toggle: true, on: false });
    renderSection('agents'); toast('Agent draft created'); log(`Created agent "Custom agent ${n}"`);
  }

  function openNav() { $('#app').classList.add('nav-open'); }
  function closeNav() { $('#app').classList.remove('nav-open'); }
  function toggleSidebar() {
    if (window.matchMedia('(max-width: 860px)').matches) { closeNav(); return; }
    const app = $('#app');
    app.classList.toggle('collapsed');
    store.set('collapsed', app.classList.contains('collapsed'));
  }

  /* ---------------- Chat ---------------- */
  const current = () => state.convos.find((c) => c.id === state.current);

  function newChat() {
    if (window.GASPro) window.GASPro.beforeNewChat();
    state.current = null;
    state.attachments = [];
    renderAttachments();
    showSection('chat');
    renderThread();
    $('#prompt').focus({ preventScroll: true });
  }
  function openConvo(id) {
    state.current = id;
    if (window.GASPro) window.GASPro.onOpenConvo(current());
    showSection('chat');
    renderThread();
  }
  function renderThread() {
    const c = current();
    const empty = !c || !c.messages.length;
    $('#chatView').classList.toggle('empty', empty);
    const th = $('#thread');
    th.innerHTML = '';
    if (c) c.messages.forEach((m) => th.append(msgEl(m)));
    applyBrand();
    paintLogos(th);
    hydrateMedia(th);
    highlight(th);
    if (empty) $('#chatScroll').scrollTo({ top: 0 }); else scrollDown(true);
    renderRecents();
  }
  function msgEl(m) {
    const el = document.createElement('div');
    el.className = 'msg ' + m.role;
    if (m.role === 'user') {
      const atts = (m.files || []).map((f) => `<span class="att">${icon('clip')}<span>${esc(f)}</span></span>`).join('');
      el.innerHTML = `<div class="bubble">${esc(m.text)}${atts ? `<div class="attachments att-row">${atts}</div>` : ''}</div>`;
    } else {
      el.innerHTML = `<span class="avatar"><span class="logo" data-logo="28"></span></span><div class="body">${m.html || ''}</div>`;
      decorateAI(el, m);
    }
    el.style.animation = 'none';
    return el;
  }
  function scrollDown(instant) {
    const sc = $('#chatScroll');
    sc.scrollTo({ top: sc.scrollHeight, behavior: instant || reduced ? 'auto' : 'smooth' });
  }

  function mediaIntent(text) {
    const t = text.toLowerCase();
    if (/\b(code|html|css|javascript|python|php|react|component|function|script|website|web page|webpage|landing page|app|api|sql)\b/.test(t)) return null;
    const verb = /\b(generate|create|make|draw|render|design|paint|produce|show me|give me|imagine)\b/.test(t);
    if (/\b(video|clip|animation|animate|movie|footage|reel)\b/.test(t) && (verb || /^\s*(a |an )?(\d+[- ]?second )?(video|clip|animation)\b/.test(t))) return 'video';
    if (/\b(image|images|picture|photo|illustration|drawing|wallpaper|artwork|poster|logo|painting|portrait)\b/.test(t) && verb) return 'image';
    if (/^\s*(draw|paint|imagine)\b/.test(t) || /^\s*(an? )?(image|picture|photo|illustration|poster|logo) of\b/.test(t)) return 'image';
    return null;
  }
  function docIntent(text) {
    const t = text.toLowerCase();
    if (mediaIntent(text)) return null;
    const fmt = /\bpdf\b/.test(t) ? 'pdf' : /\b(word|docx|ms word)\b/.test(t) ? 'docx' : null;
    const verb = /\b(create|make|generate|write|draft|prepare|export|save|turn|convert|produce|give me|build|compose)\b/.test(t);
    const noun = /\b(document|doc|report|proposal|letter|contract|memo|resume|cv|invoice|quotation|policy|sop|agreement|minutes|brief|essay|handbook|guide|certificate|summary|plan|notice|manual)\b/.test(t);
    return (fmt && (verb || noun)) || (verb && noun) ? (fmt || 'both') : null;
  }
  function searchIntent(text) {
    const t = text.toLowerCase().trim();
    if (mediaIntent(text) || docIntent(text) && !/\b(search|look ?up|research)\b/.test(t)) return false;
    return /^(who|what) (is|was|are|were)\s+(?!the (best|difference|meaning) )\S/.test(t) || /\b(search( the web| online)?|look ?up|google|find (info|information|out about)|tell me about|research|latest news|news about|biography|bio of|profile of|what do you know about)\b/.test(t);
  }
  function sampleDoc(text) {
    const topic = text.replace(/^(please\s+)?(create|make|generate|write|draft|prepare|give me|build|compose)\s+(me\s+)?(a|an|the)?\s*/i, '').replace(/\s*(as|in|into)\s+(a\s+)?(pdf|word|docx)( and (pdf|word|docx))?( files?| documents?)?\.?$/i, '').replace(/[.?!]+$/, '').trim() || 'Document';
    const title = topic.charAt(0).toUpperCase() + topic.slice(1, 80);
    return `# ${title}\n\nPrepared by ${state.brand.name} on ${new Date().toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' })}.\n\n## Summary\n\nThis is a sample document created in offline preview. On your live site the AI writes the full content for "${topic}".\n\n## Key points\n\n- The goal and who this document is for\n- The main facts, figures and decisions\n- Risks, open questions and how to handle them\n\n## Details\n\n| Item | Owner | Due |\n|---|---|---|\n| First draft | You | This week |\n| Review | Team lead | Next week |\n| Final version | You | End of month |\n\n## Next steps\n\n1. Add your own details to each section\n2. Share it for review\n3. Download the final version as PDF or Word`;
  }

  /* Reply extras: export bar, document card and sources */
  function sourcesHTML(list) {
    if (!list || !list.length) return '';
    return `<div class="sources"><span class="src-label">${icon('search')}Sources</span>${list.map((r, i) => `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" title="${esc(r.title)}"><b>${i + 1}</b>${esc(r.title.slice(0, 48))}<small>${esc(r.source || '')}</small></a>`).join('')}</div>`;
  }
  function docCardHTML(title) {
    return `<div class="doc-card"><span class="dc-ico">${icon('file')}</span><span class="dc-text"><b>${esc(title)}</b><small>Ready to download</small></span><span class="dc-acts"><button type="button" class="dc-btn pdf" data-export="pdf">${icon('download')}PDF</button><button type="button" class="dc-btn word" data-export="docx">${icon('download')}Word</button></span></div>`;
  }
  function msgActionsHTML() {
    return `<div class="msg-actions"><button type="button" data-msgact="copy" title="Copy the reply">${icon('copy')}<span>Copy</span></button><button type="button" data-export="pdf" title="Download this reply as a PDF">${icon('file')}<span>PDF</span></button><button type="button" data-export="docx" title="Download this reply as a Word document">${icon('file')}<span>Word</span></button></div>`;
  }
  function decorateAI(el, m) {
    const body = $('.body', el); const text = m.text || htmlToText(m.html);
    el._md = text; el._title = m.doc ? m.doc.title : '';
    if (!text || (m.html || '').includes('media-slot')) return;
    if (m.sources) body.insertAdjacentHTML('beforeend', sourcesHTML(m.sources));
    if (m.doc) body.insertAdjacentHTML('beforeend', docCardHTML(m.doc.title));
    body.insertAdjacentHTML('beforeend', msgActionsHTML());
  }
  function saveDocArtifact(md2, title) {
    const name = `${title.replace(/[\\/:*?"<>|]+/g, '').slice(0, 60)}.pdf`;
    state.artifacts = state.artifacts.filter((a) => a.name !== name);
    state.artifacts.unshift({ name, kind: 'pdf', meta: 'Document · PDF and Word', time: now(), doc: md2, gen: true });
    log(`Created ${name}`);
  }
  async function exportDoc(kind, md2, title) {
    if (!window.GASDocs) { toast('Document export is not available.', 'x'); return; }
    try { toast(kind === 'pdf' ? 'Creating PDF…' : 'Creating Word document…', 'file'); const name = await window.GASDocs.save(kind, md2, title || undefined); toast(`Downloaded ${name}`, 'download'); log(`Downloaded ${name}`); }
    catch (e) { toast(e.message || 'Could not create the file.', 'x'); }
  }
  function openDoc(a) {
    $('#lb-h').textContent = a.name.replace(/\.pdf$/, '');
    $('#lbMeta').textContent = 'Document · download as PDF or Word';
    $('#lbStage').innerHTML = `<div class="doc-preview">${md(a.doc)}</div>`;
    const acts = $('#lbActions'); acts.innerHTML = '';
    const title = window.GASDocs ? window.GASDocs.titleOf(a.doc, a.name) : a.name;
    [['Copy text', 'copy', () => copy(a.doc, 'Text copied')], ['Word', 'download', () => exportDoc('docx', a.doc, title)], ['PDF', 'download', () => exportDoc('pdf', a.doc, title), true]].forEach(([l, i, fn, pr]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = pr ? 'btn-primary' : 'btn-ghost'; b.innerHTML = icon(i) + esc(l); b.onclick = fn; acts.append(b);
    });
    openModal('lightbox');
  }

  function makeReply(text, files) {
    const t = text.toLowerCase();
    const B = [];
    const brand = state.brand.name;
    if (!aiAvailable() && !mediaIntent(text)) B.push({ type: 'note', text: 'Offline preview: live AI is not available here, so this is a sample reply. It turns on automatically on your Vercel site.' });
    if (state.mode === 'Plan') B.push({ type: 'p', text: 'Plan mode is on, so here is the plan before I touch anything.' });
    if (files && files.length) B.push({ type: 'p', text: `I received ${files.length} attachment${files.length > 1 ? 's' : ''}: ${files.join(', ')}. I'll use ${files.length > 1 ? 'them' : 'it'} as context.` });

    const intent = mediaIntent(text);
    const wantsVideo = intent === 'video', wantsImage = intent === 'image';
    if ((wantsVideo && !state.prefs.capVideo) || (wantsImage && !state.prefs.capImages)) {
      return [{ type: 'note', text: `${wantsVideo ? 'Video' : 'Image'} generation is turned off. Turn it on in Settings → Capabilities.` }];
    }
    if (wantsVideo || wantsImage) {
      const spec = { kind: wantsVideo ? 'video' : 'image', prompt: text, seed: Gen.hash(text + now()) };
      const name = Gen.title(text);
      const B2 = [{ type: 'note', text: wantsVideo ? 'This clip animates an AI-generated keyframe (Flux, free). If the image cannot load, a local animation is used instead.' : 'AI images are generated with the free Flux model. If an image cannot load, a local preview is drawn instead.' }];
      if (state.mode === 'Plan') B2.push({ type: 'p', text: `Plan: read the prompt, compose the scene, render ${wantsVideo ? 'a 6-second loop' : '4 variations'}, then save to Artifacts.` });
      if (wantsVideo) {
        B2.push({ type: 'p', text: `Here is a 6-second clip of "${name}". It loops; pause, scrub or download it as WebM with the controls.` });
        B2.push({ type: 'media', spec, label: 'Generating video', steps: ['Reading prompt', 'Building storyboard', 'Rendering 180 frames', 'Encoding preview'] });
        B2.push({ type: 'meta', items: ['960 × 540 preview', '30 fps', '6 s loop', `seed ${spec.seed}`] });
        B2.push({ type: 'file', name: name + '.webm', kind: 'webm', meta: 'Video · 6 s · 1280 × 720 · saved to Artifacts', media: spec });
      } else {
        B2.push({ type: 'p', text: `Here are 4 variations of "${name}". Click any image to view it full size or download it as PNG.` });
        B2.push({ type: 'media', spec, label: 'Generating 4 images', steps: ['Reading prompt', 'Composing scene', 'Rendering variations', 'Upscaling to 1600 × 1000'] });
        B2.push({ type: 'meta', items: ['4 variations', '1600 × 1000 PNG', `seed ${spec.seed}`] });
        B2.push({ type: 'file', name: name + '.png', kind: 'png', meta: 'Image · 4 variations · 1600 × 1000 · saved to Artifacts', media: spec });
      }
      return B2;
    }
    if (/excel|xlsx|tracker|spreadsheet|priorit/.test(t)) {
      B.push({ type: 'p', text: 'I built a quarterly priorities tracker with owners, due dates, progress and status. Status turns red when progress falls behind the calendar.' });
      B.push({ type: 'table', head: ['Priority', 'Owner', 'Due', 'Progress', 'Status'], rows: [
        ['Launch onboarding v2', 'Amira', '15 Nov', '72%', ['on', 'On track']],
        ['Cut support backlog 30%', 'Jon', '30 Nov', '41%', ['risk', 'At risk']],
        ['Close 3 partner deals', 'Sara', '12 Dec', '55%', ['on', 'On track']],
        ['Hire 2 engineers', 'Lee', '20 Dec', '20%', ['idle', 'Not started']],
      ] });
      B.push({ type: 'file', name: 'Q4 priorities tracker.xlsx', kind: 'xlsx', meta: `Spreadsheet · 2 sheets · saved to ${state.workspace.name}/` });
    } else if (/file|folder|workspace/.test(t)) {
      const files2 = state.workspace.files;
      if (files2 && files2.length) {
        B.push({ type: 'p', text: `Your folder "${state.workspace.name}" has ${files2.length} file${files2.length > 1 ? 's' : ''}. Here are the first ones:` });
        B.push({ type: 'files', items: files2.slice(0, 8) });
        B.push({ type: 'p', text: 'Want a summary of any of these, or should I organise them into sub-folders?' });
      } else {
        B.push({ type: 'p', text: `This is the sample "${state.workspace.name}" workspace. Open your own folder with the folder button below and I will list your real files.` });
        B.push({ type: 'files', items: [{ name: 'reports/', size: '6 items' }, { name: 'Q3 review.pdf', size: '1.2 MB' }, { name: 'Budget 2026.xlsx', size: '84 KB' }, { name: 'Meeting notes.md', size: '9 KB' }, { name: 'Brand logo.png', size: '310 KB' }] });
      }
    } else if (/^(hi|hello|hey|salam|good (morning|afternoon|evening))\b/.test(t)) {
      B.push({ type: 'p', text: `Hello! I'm ${brand}. I can chat, work with files in your workspace, and create documents, spreadsheets, PDFs and images. What should we start with?` });
    } else {
      const short = text.length > 60 ? text.slice(0, 57) + '…' : text;
      const rn = window.GASPro && window.GASPro.roleName();
      B.push({ type: 'p', text: rn ? `As your ${rn}, here's how I would approach "${short}":` : `Here's how I would approach "${short}":` });
      B.push({ type: 'list', items: ['Clarify the goal and what a good result looks like', 'Gather what I need from your workspace files', 'Draft the result and save it where you can find it'] });
      B.push({ type: 'p', text: state.auto ? 'Auto-approve is on, so I will go ahead with file changes without asking.' : 'I will ask before creating or changing any files. Shall I start?' });
    }
    if (state.mode === 'Quick' || state.prefs.tone === 'Concise') return B.filter((b) => b.type !== 'list').slice(0, 3);
    return B;
  }

  function blockHTML(b) {
    switch (b.type) {
      case 'p': return `<p>${esc(b.text)}</p>`;
      case 'note': return `<p class="note">${esc(b.text)}</p>`;
      case 'list': return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
      case 'media': return `<div class="media-slot" data-media="${esc(JSON.stringify(b.spec))}"></div>`;
      case 'meta': return `<p class="gen-meta">${b.items.map((i) => `<span>${esc(i)}</span>`).join('')}</p>`;
      case 'file': return `<div class="file-card"><span class="fc-ico ${b.kind}">${icon({ xlsx: 'sheet', png: 'image', webm: 'video' }[b.kind] || 'file')}</span><span class="fc-text"><b>${esc(b.name)}</b><small>${esc(b.meta)}</small></span><button class="fc-open" data-artifact="${esc(b.name)}">Open</button></div>`;
      case 'table': return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${Array.isArray(c) ? `<span class="pill ${c[0]}">${esc(c[1])}</span>` : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      case 'files': return `<ul class="flist">${b.items.map((f) => `<li>${icon(/\/$/.test(f.name) ? 'folder' : 'file')}<span>${esc(f.name)}</span><small>${esc(f.size || '')}</small></li>`).join('')}</ul>`;
      default: return '';
    }
  }

  async function send(raw, reAttach) {
    if (AI.ctrl) { AI.ctrl.abort(); return; }
    const text = (raw ?? $('#prompt').value).trim();
    if (!text || state.busy) return;
    state.busy = true;
    $('#sendBtn').disabled = true;
    let c = current();
    if (!c) {
      c = { id: 'c-' + now().toString(36), title: text.length > 42 ? text.slice(0, 40) + '…' : text, updated: now(), messages: [], role: window.GASPro ? window.GASPro.roleId() : undefined };
      state.convos.unshift(c);
      state.current = c.id;
    }
    const attach = reAttach || state.attachments.map((f) => ({ name: f.name, text: f.text || '' }));
    const files = attach.map((f) => f.name);
    c.messages.push({ role: 'user', text, files, attach: attach.length ? attach : undefined });
    c.updated = now();
    state.attachments = []; renderAttachments();
    $('#prompt').value = ''; autosize();
    renderThread();
    log(`Message sent (${state.mode} mode${state.auto ? ', auto-approve' : ''})`);
    if (state.skin === 'cyber') $('#cyState').textContent = 'processing';

    // Typing indicator
    const holder = document.createElement('div');
    holder.className = 'msg ai';
    holder.innerHTML = `<span class="avatar"><span class="logo" data-logo="28"></span></span><div class="body"><span class="typing" aria-label="Thinking"><i></i><i></i><i></i></span></div>`;
    $('#thread').append(holder); paintLogos(holder); scrollDown();
    const wantDoc = docIntent(text);
    let sources = [];
    AI.webContext = '';
    if (aiAvailable() && !mediaIntent(text) && AI.backend && (searchIntent(text) || (state.prefs.capWeb && !wantDoc))) {
      $('.body', holder).innerHTML = `<span class="web-step">${icon('search')}Searching the web…</span>`;
      try {
        const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(`/api/search?q=${encodeURIComponent(text.slice(0, 300))}`, { signal: ctl.signal }); clearTimeout(tm);
        const j = r.ok ? await r.json() : null;
        sources = (j && j.results) || [];
        if (sources.length) {
          AI.webContext = `Web results for the user's latest message (search: "${j.query}"). Base facts on these, cite them inline as [1], [2] and so on, and say so if they do not answer the question:\n\n${sources.map((s, i) => `[${i + 1}] ${s.title} (${s.source}, ${s.url})\n${s.snippet}`).join('\n\n')}`;
          log(`Web search: ${sources.length} results for "${j.query}"`);
        } else log('Web search: no results');
      } catch { log('Web search failed'); }
      $('.body', holder).innerHTML = `${sources.length ? `<span class="web-step done">${icon('check')}Found ${sources.length} source${sources.length === 1 ? '' : 's'}</span>` : ''}<span class="typing" aria-label="Thinking"><i></i><i></i><i></i></span>`;
    }
    if (aiAvailable() && !mediaIntent(text)) {
      const { out } = await streamReply(holder, c, c.title, { sources, doc: !!wantDoc });
      AI.webContext = '';
      c.updated = now(); save(); renderRecents();
      if (out && state.voice && 'speechSynthesis' in window) {
        try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(htmlToText(md(out.replace(/```[\s\S]*?```/g, ' (code) '))).slice(0, 1500))); } catch { /* speech unavailable */ }
      }
      if (state.skin === 'cyber') $('#cyState').textContent = 'link online';
      state.busy = false; $('#sendBtn').disabled = false;
      return;
    }
    await sleep(reduced ? 50 : 650 + Math.random() * 500);

    if (wantDoc) {
      const docMd = sampleDoc(text);
      const m = { role: 'ai', text: docMd, html: '<p class="note">Offline preview: live AI is not available here, so this is a sample document. On your Vercel site the AI writes the full content.</p>' + md(docMd), doc: { title: window.GASDocs ? window.GASDocs.titleOf(docMd) : 'Document' } };
      const body0 = $('.body', holder); body0.innerHTML = m.html; decorateAI(holder, m);
      c.messages.push(m); c.updated = now(); saveDocArtifact(docMd, m.doc.title); save(); renderRecents(); scrollDown(true);
      state.busy = false; $('#sendBtn').disabled = false;
      return;
    }
    const blocks = makeReply(text, files);
    const body = $('.body', holder);
    body.innerHTML = '';
    for (const b of blocks) {
      if ((b.type === 'p') && !reduced && state.prefs.streamReplies) {
        const p = document.createElement('p'); p.className = 'caret'; body.append(p);
        for (let i = 0; i <= b.text.length; i += 3) { p.textContent = b.text.slice(0, i); if (i % 30 === 0) scrollDown(true); await sleep(10); }
        p.textContent = b.text; p.classList.remove('caret');
      } else if (b.type === 'media') {
        const prog = document.createElement('div'); prog.className = 'gen-progress';
        prog.innerHTML = `<div class="gp-top"><span>${esc(b.label)}</span><span>0%</span></div><div class="gp-bar"><i></i></div><small>${esc(b.steps[0])}…</small>`;
        body.append(prog); scrollDown(true);
        const total = reduced ? 1 : (b.spec.kind === 'video' ? 34 : 26);
        for (let i = 1; i <= total; i++) {
          const pct = Math.round((i / total) * 100);
          $('.gp-top span:last-child', prog).textContent = pct + '%';
          $('.gp-bar i', prog).style.width = pct + '%';
          $('small', prog).textContent = b.steps[Math.min(b.steps.length - 1, Math.floor((i / total) * b.steps.length))] + '…';
          await sleep(reduced ? 0 : 70 + Math.random() * 50);
        }
        prog.outerHTML = blockHTML(b);
        hydrateMedia(body);
      } else {
        body.insertAdjacentHTML('beforeend', blockHTML(b));
        await sleep(reduced ? 0 : 120);
      }
      scrollDown(true);
    }
    const html = blocks.map(blockHTML).join('');
    c.messages.push({ role: 'ai', html });
    c.updated = now();
    blocks.filter((b) => b.type === 'file').forEach((b) => {
      state.artifacts = state.artifacts.filter((a) => a.name !== b.name);
      state.artifacts.unshift({ name: b.name, kind: b.kind, meta: b.meta.split(' · saved')[0], time: now(), media: b.media, gen: true });
      log(`Created ${b.name}`);
    });
    save(); renderRecents();
    if (state.voice && 'speechSynthesis' in window) {
      try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(blocks.filter((b) => b.type === 'p').map((b) => b.text).join(' '))); } catch { /* speech unavailable */ }
    }
    if (state.skin === 'cyber') $('#cyState').textContent = aiAvailable() ? 'link online' : 'offline preview';
    state.busy = false;
    $('#sendBtn').disabled = false;
  }

  function autosize() {
    const ta = $('#prompt');
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  function renderAttachments() {
    const box = $('#attachments');
    box.hidden = !state.attachments.length;
    box.innerHTML = state.attachments.map((f, i) => `<span class="att">${icon('clip')}<span>${esc(f.name)}</span><button type="button" data-rm="${i}" aria-label="Remove ${esc(f.name)}">${icon('x')}</button></span>`).join('');
  }

  /* ---------------- Model setup ---------------- */
  let provSel = PROVIDERS[0];
  function openModel() {
    const sel = state.model ? PROVIDERS.find((p) => p.id === state.model.providerId) : null;
    provSel = sel || PROVIDERS[0];
    $('#providers').innerHTML = PROVIDERS.map((p) => `<button type="button" class="prov" role="radio" aria-checked="${p === provSel}" data-prov="${p.id}"><b>${p.name}</b><small>${p.sub}</small></button>`).join('');
    $('#apiKey').value = '';
    $('#modelError').textContent = '';
    paintProv(state.model && sel ? state.model.model : null);
    openModal('modelModal');
  }
  function paintProv(model) {
    $$('#providers .prov').forEach((b) => b.setAttribute('aria-checked', b.dataset.prov === provSel.id));
    const local = provSel.type === 'local';
    $('#keyField').hidden = local;
    $('#urlField').hidden = !local;
    if (local) $('#baseUrl').value = provSel.url;
    $('#apiKey').placeholder = `Paste your ${provSel.name} API key`;
    $('#modelId').value = model || provSel.model;
  }
  function connectModel(e) {
    e.preventDefault();
    const local = provSel.type === 'local';
    const key = $('#apiKey').value.trim();
    const url = $('#baseUrl').value.trim();
    const model = $('#modelId').value.trim();
    const err = $('#modelError');
    if (!local && key.length < 8) { err.textContent = `Paste the API key from your ${provSel.name} dashboard. It should be longer than 8 characters.`; $('#apiKey').focus(); return; }
    if (local && !/^https?:\/\//.test(url)) { err.textContent = 'Enter the server address, starting with http:// (for example http://localhost:1234/v1).'; $('#baseUrl').focus(); return; }
    if (!model) { err.textContent = 'Enter the model name to use.'; $('#modelId').focus(); return; }
    state.model = { providerId: provSel.id, provider: provSel.name, model, baseUrl: local ? url : undefined };
    AI.key = local ? null : key;
    store.set('model', state.model);
    state.choice = model;
    if (!local && !AI.backend) toast('Your key works through the GAS Agent server, so it needs the Vercel site.', 'key');
    closeModals();
    paintModel();
    toast(`Connected to ${provSel.name}`);
    log(`Model connected: ${provSel.name} / ${model}`);
  }
  function disconnectModel() {
    state.model = null; state.choice = 'Auto'; AI.key = null;
    store.set('model', null);
    paintModel();
    toast('Model disconnected', 'x');
    log('Model disconnected');
  }
  function paintModel() {
    const own = ownModelActive(), b = AI.backend, online = !!b || usingLocal();
    $('#modelName').textContent = own ? state.model.model : (b || !AI.checked ? (state.skin === 'pro' && window.innerWidth > 640 ? 'Auto model' : 'Auto') : 'Offline');
    $('#modelDot').classList.toggle('on', online);
    $('#modelBtn').title = own ? `${state.model.provider} · ${state.model.model}` : b ? `${b.provider} · ${b.model}` : 'Offline preview';
    $('#stModel').textContent = online ? `Model: ${own ? state.model.provider : b.provider}` : 'Model: offline';
    $('#cyState').textContent = online ? 'link online' : 'offline preview';
    if (!$('#settingsModal').hidden) renderSettings();
  }

  /* ---------------- Modals, popovers, palette ---------------- */
  let lastFocus = null;
  function openModal(id) {
    lastFocus = document.activeElement;
    closePopover();
    const m = $('#' + id); m.hidden = false;
    const f = $('input:not([type=radio]), button.prov[aria-checked="true"], button', m);
    setTimeout(() => f && f.focus(), 30);
  }
  function closeModals() {
    $$('.modal').forEach((m) => { m.hidden = true; });
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  function closeAllOverlays() { closeModals(); closePopover(); $('#activity').hidden = true; endTour(); }

  function popover(anchor, html, onClick) {
    const pop = $('#popover');
    if (!pop.hidden && pop._anchor === anchor) { closePopover(); return; }
    pop.innerHTML = html; pop.hidden = false; pop._anchor = anchor;
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = Math.min(Math.max(12, r.left), window.innerWidth - pw - 12);
    let top = r.bottom + 8;
    if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    pop.onclick = (e) => { const b = e.target.closest('[data-pick]'); if (b) { const keep = onClick && onClick(b.dataset.pick) === 'keep'; if (!keep) closePopover(); } };
    anchor.setAttribute('aria-expanded', 'true');
  }
  function closePopover() { const p = $('#popover'); if (p._anchor) p._anchor.removeAttribute('aria-expanded'); p.hidden = true; p._anchor = null; }

  const MODES = [
    ['Normal', 'Chats and acts, asking before changing files'],
    ['Plan', 'Outlines the steps before doing anything'],
    ['Quick', 'Short, direct answers'],
  ];
  function modeMenu(a) {
    popover(a, `<p class="pop-title">Response mode</p>` + MODES.map(([n, d]) => `<button class="pop-item" data-pick="${n}">${icon(n === 'Plan' ? 'layers' : n === 'Quick' ? 'spark' : 'pencil')}<span><b>${n}</b><small>${d}</small></span>${state.mode === n ? icon('check', 'chk') : ''}</button>`).join(''),
      (v) => { state.mode = v; $('#modeName').textContent = v; toast(`${v} mode`); log(`Mode set to ${v}`); });
  }
  function modelMenu(a) {
    const opts = [['Auto', AI.backend ? `Built-in AI · ${AI.backend.provider} · ${AI.backend.model}` : 'Offline preview · live AI turns on at your Vercel site']];
    if (state.model) opts.push([state.model.model, `${state.model.provider} · ${LOCAL_PROVIDERS.includes(state.model.providerId) || AI.key ? 'your model' : 'enter your key again to use it'}`]);
    popover(a, `<p class="pop-title">Model</p>` + opts.map(([n, d]) => `<button class="pop-item" data-pick="${esc(n)}">${icon('cpu')}<span><b>${esc(n)}</b><small>${esc(d)}</small></span>${state.choice === n ? icon('check', 'chk') : ''}</button>`).join('')
      + `<button class="pop-item" data-pick="__setup">${icon('key')}<span><b>Use your own model</b><small>Your API key, or LM Studio / Ollama on this computer</small></span></button>`,
      (v) => { if (v === '__setup') openModel(); else if (v !== 'Auto' && state.model && !LOCAL_PROVIDERS.includes(state.model.providerId) && !AI.key) openModel(); else { state.choice = v; paintModel(); } });
  }
  function skinMenu(a) {
    popover(a, `<p class="pop-title">Interface</p>` + Object.entries(SKINS).map(([k, v]) => `<button class="pop-item" data-pick="${k}"><span class="sw sw-${k}"></span><span><b>${v.name}</b><small>${v.label}</small></span>${state.skin === k ? icon('check', 'chk') : ''}</button>`).join('')
      + `<div class="pop-sep"></div><button class="pop-item" data-pick="__home">${icon('home')}<span><b>Studio</b><small>Compare all seven interfaces</small></span></button>`,
      (v) => { location.hash = v === '__home' ? 'studio' : v; });
  }
  function plusMenu(a) {
    popover(a, `<p class="pop-title">Add or create</p>
      <button class="pop-item" data-pick="files">${icon('clip')}<span><b>Attach files</b><small>Add documents or images as context</small></span></button>
      <button class="pop-item" data-pick="image">${icon('image')}<span><b>Generate an image</b><small>4 AI variations · free Flux model</small></span></button>
      <button class="pop-item" data-pick="video">${icon('video')}<span><b>Create a video</b><small>6-second AI motion clip</small></span></button>
      <button class="pop-item" data-pick="doc">${icon('file')}<span><b>Create a document</b><small>Download as PDF or Word</small></span></button>
      <button class="pop-item" data-pick="search">${icon('search')}<span><b>Search the web</b><small>People, companies and topics, with sources</small></span></button>`,
      (v) => {
        if (v === 'files') { $('#fileInput').click(); return; }
        $('#prompt').value = { image: 'Generate an image of ', video: 'Create a 6-second video of ', doc: 'Write a document about ', search: 'Search the web for ' }[v];
        autosize(); const ta = $('#prompt'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      });
  }
  function notifMenu(a) {
    $('#bellBtn').classList.remove('has-dot');
    popover(a, `<p class="pop-title">Notifications</p>
      <button class="pop-item" data-pick="model">${icon('key')}<span><b>${aiAvailable() ? 'AI is online' : 'Offline preview'}</b><small>${AI.backend ? esc(`${AI.backend.provider} · ${AI.backend.model}`) : usingLocal() ? esc(state.model.provider + ' on this computer') : 'Live AI turns on at your Vercel site'}</small></span></button>
      <button class="pop-item" data-pick="scheduled">${icon('clock')}<span><b>Weekly status report</b><small>Runs Friday at 16:00</small></span></button>
      <button class="pop-item" data-pick="team">${icon('users')}<span><b>Amira shared “Design review”</b><small>Team room · 5 min ago</small></span></button>`,
      (v) => { if (v === 'model') { if (!aiAvailable()) openModel(); } else showSection(v); });
  }

  /* Command palette */
  let palItems = [], palIdx = 0;
  function openPalette() {
    openModal('palette');
    $('#palInput').value = '';
    renderPalette();
  }
  function paletteSource() {
    const cmds = [
      { g: 'Actions', label: 'New chat', ico: 'plus', run: newChat, hint: 'N' },
      { g: 'Actions', label: state.model ? 'Change model provider' : 'Set up a model', ico: 'key', run: openModel },
      { g: 'Actions', label: 'Open local folder', ico: 'folder', run: pickFolder },
      { g: 'Actions', label: 'Generate an image', ico: 'image', run: () => { newChat(); $('#prompt').value = 'Generate an image of '; autosize(); } },
      { g: 'Actions', label: 'Create a video', ico: 'video', run: () => { newChat(); $('#prompt').value = 'Create a 6-second video of '; autosize(); } },
      { g: 'Actions', label: 'Settings', ico: 'settings', run: () => openSettings() },
      { g: 'Actions', label: 'Upgrade plan', ico: 'spark', hint: 'Billing', run: () => openSettings('billing') },
      { g: 'Actions', label: 'Usage', ico: 'gauge', run: () => openSettings('usage') },
      { g: 'Actions', label: 'Guide & tour', ico: 'compass', run: startTour },
      ...Object.entries(SECTIONS).map(([k, s]) => ({ g: 'Go to', label: s.title, ico: s.icon, run: () => showSection(k) })),
      ...Object.entries(SKINS).map(([k, s]) => ({ g: 'Interface', label: `${s.name} interface`, ico: 'layers', hint: s.label, run: () => { location.hash = k; } })),
      { g: 'Interface', label: 'Back to studio', ico: 'home', run: () => { location.hash = 'studio'; } },
      ...(window.GASPro ? window.GASPro.paletteItems() : []),
      ...state.convos.filter((c) => !c.archived).map((c) => ({ g: 'Chats', label: c.title, ico: 'search', hint: relTime(c.updated), run: () => openConvo(c.id) })),
    ];
    return cmds;
  }
  function renderPalette() {
    const q = $('#palInput').value.trim().toLowerCase();
    palItems = paletteSource().filter((c) => !q || c.label.toLowerCase().includes(q) || c.g.toLowerCase().includes(q));
    palIdx = 0;
    let g = '';
    $('#palList').innerHTML = palItems.length ? palItems.map((c, i) => {
      const head = c.g !== g ? `<li class="pal-group" role="presentation">${(g = c.g)}</li>` : '';
      return `${head}<li role="option" data-i="${i}" aria-selected="${i === 0}">${icon(c.ico)}<span>${esc(c.label)}</span>${c.hint ? `<small>${esc(c.hint)}</small>` : ''}</li>`;
    }).join('') : '<li class="pal-group" role="presentation">No results. Try “chat”, “clay” or “settings”.</li>';
  }
  function palMove(d) {
    if (!palItems.length) return;
    palIdx = (palIdx + d + palItems.length) % palItems.length;
    $$('#palList [role=option]').forEach((li) => li.setAttribute('aria-selected', +li.dataset.i === palIdx));
    const sel = $(`#palList [data-i="${palIdx}"]`); sel && sel.scrollIntoView({ block: 'nearest' });
  }
  function palRun(i) { const c = palItems[i]; if (!c) return; closeModals(); c.run(); }

  /* ---------------- Settings center ----------------
     Left: searchable section list. Right: rows of label + description +
     control. Every change saves immediately to this browser. Billing has
     PHP plans with a Monthly / Annual switch and a test-mode checkout. */
  const PREF_DEFAULTS = {
    displayName: '', email: '', language: 'English',
    fontSize: 'Default', reduceMotion: false, sidebarStart: 'Expanded',
    defaultMode: 'Normal', autoApproveDefault: false, streamReplies: true,
    capImages: true, capVideo: true, capFiles: true, capWeb: false, capCode: false,
    notifScheduled: true, notifTeam: true, notifEmail: false, notifSound: false,
    saveHistory: true, analytics: false,
    instructions: '', tone: 'Balanced', replyLanguage: 'Match my message',
    branchPrefix: 'gas', labelSessions: true, transcriptView: 'Normal', autoPR: false, prDraft: true, autoFix: false,
  };
  state.prefs = Object.assign({}, PREF_DEFAULTS, store.get('prefs', {}));
  state.billing = Object.assign({ plan: 'free', cycle: 'monthly', renews: null, invoices: [] }, store.get('billing', {}));
  const savePrefs = () => store.set('prefs', state.prefs);
  const saveBilling = () => store.set('billing', state.billing);

  const PLANS = [
    { id: 'free', name: 'Free', blurb: 'For trying the agent with your own key or a local model.', monthly: 0, annual: 0,
      features: ['50 messages a month', '10 images and 2 videos a month', '1 project', 'Bring your own model key'], limits: { messages: 50, images: 10, videos: 2, storage: 100 } },
    { id: 'pro', name: 'Pro', blurb: 'For people who use the agent every day.', monthly: 499, annual: 4990, popular: true,
      features: ['2,000 messages a month', '500 images and 50 videos a month', 'Unlimited projects', 'Scheduled tasks and agents', 'Priority speed'], limits: { messages: 2000, images: 500, videos: 50, storage: 10240 } },
    { id: 'team', name: 'Team', blurb: 'For teams sharing projects, agents and files.', monthly: 1299, annual: 12990, perSeat: true,
      features: ['Everything in Pro', '5,000 messages per member', 'Team room and shared projects', 'Admin controls and roles', 'Central billing'], limits: { messages: 5000, images: 1500, videos: 150, storage: 51200 } },
  ];
  const peso = (n) => '₱' + n.toLocaleString('en-PH');
  const planById = (id) => PLANS.find((p) => p.id === id) || PLANS[0];
  const fmtDate = (t) => new Date(t).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });

  const SET_SECTIONS = [
    { id: 'account', label: 'Account', icon: 'user', rows: [
      { type: 'input', key: 'displayName', label: 'Display name', desc: 'How the agent addresses you.', placeholder: 'Your name' },
      { type: 'input', key: 'email', label: 'Email', desc: 'Used for receipts and email notifications.', placeholder: 'you@company.com', inputType: 'email' },
      { type: 'select', key: 'language', label: 'Interface language', desc: 'Language for menus and labels.', options: ['English', 'Filipino', 'Español', 'العربية'] },
      { type: 'plan-summary' },
    ] },
    { id: 'billing', label: 'Billing', icon: 'card', rows: [{ type: 'billing' }] },
    { id: 'usage', label: 'Usage', icon: 'gauge', rows: [{ type: 'usage' }] },
    { sep: true },
    { id: 'appearance', label: 'Appearance', icon: 'palette', rows: [
      { type: 'skins', label: 'Interface', desc: 'Choose one of the six white-label interfaces.' },
      { type: 'brand', key: 'name', label: 'Product name', desc: 'Replaces “GAS Agent” everywhere.' },
      { type: 'brand', key: 'tagline', label: 'Subtitle', desc: 'Shown under the product name.' },
      { type: 'segment', key: 'fontSize', label: 'Text size', desc: 'Scale text and controls.', options: ['Small', 'Default', 'Large'] },
      { type: 'toggle', key: 'reduceMotion', label: 'Reduce motion', desc: 'Turn off background animation and transitions.' },
    ] },
    { id: 'model', label: 'Model', icon: 'cpu', rows: [
      { type: 'model' },
      { type: 'segment', key: 'defaultMode', label: 'Default response mode', desc: 'Mode new chats start in.', options: ['Normal', 'Plan', 'Quick'] },
      { type: 'toggle', key: 'autoApproveDefault', label: 'Auto-approve by default', desc: 'Let the agent create and change files without asking first.' },
      { type: 'toggle', key: 'streamReplies', label: 'Stream replies', desc: 'Show replies word by word as they are written.' },
    ] },
    { id: 'capabilities', label: 'Capabilities', icon: 'layers', rows: [
      { type: 'toggle', key: 'capImages', label: 'Image generation', desc: 'Create images from a description.' },
      { type: 'toggle', key: 'capVideo', label: 'Video generation', desc: 'Create short looping video clips.' },
      { type: 'toggle', key: 'capFiles', label: 'Workspace files', desc: 'Read files in the folder you open.' },
      { type: 'toggle', key: 'capWeb', label: 'Web search', desc: 'Look things up online when a model is connected.' },
      { type: 'toggle', key: 'capCode', label: 'Code execution', desc: 'Run code in a sandbox to check results.' },
    ] },
    { id: 'notifications', label: 'Notifications', icon: 'bell', rows: [
      { type: 'toggle', key: 'notifScheduled', label: 'Scheduled task finished', desc: 'Tell me when a scheduled task completes.' },
      { type: 'toggle', key: 'notifTeam', label: 'Team room activity', desc: 'Mentions and shared chats from teammates.' },
      { type: 'toggle', key: 'notifEmail', label: 'Email summaries', desc: 'A weekly email of what your agents did.' },
      { type: 'toggle', key: 'notifSound', label: 'Sound', desc: 'Play a short sound when a reply finishes.' },
    ] },
    { id: 'privacy', label: 'Privacy', icon: 'shield', rows: [
      { type: 'toggle', key: 'saveHistory', label: 'Save chat history', desc: 'Keep chats in this browser after you close the tab.' },
      { type: 'toggle', key: 'analytics', label: 'Share usage analytics', desc: 'Send anonymous usage counts to help improve the product.' },
      { type: 'action', label: 'Export chats', desc: 'Download all chats as a JSON file.', button: 'Export', run: () => exportChats() },
      { type: 'action', label: 'Clear all chats', desc: 'Delete every chat from this browser. This can’t be undone.', button: 'Clear chats', danger: true, run: () => clearChats() },
    ] },
    { sep: true },
    { id: 'customize', label: 'Customize', icon: 'wand', rows: [
      { type: 'textarea', key: 'instructions', label: 'Custom instructions', desc: 'What should the agent know about you and how you work?', placeholder: 'e.g. I run a small logistics company in Cebu. Keep answers short and use pesos.' },
      { type: 'segment', key: 'tone', label: 'Response style', desc: 'How much detail replies include.', options: ['Concise', 'Balanced', 'Detailed'] },
      { type: 'select', key: 'replyLanguage', label: 'Reply language', desc: 'Language the agent answers in.', options: ['Match my message', 'English', 'Filipino', 'Español'] },
    ] },
    { id: 'code', label: 'Code', icon: 'code', rows: [
      { type: 'input', key: 'branchPrefix', label: 'Branch prefix', desc: 'Added to the start of every branch name the agent creates.', placeholder: 'gas' },
      { type: 'toggle', key: 'labelSessions', label: 'Label sessions by status', desc: 'Mark each session as blocked, ready for review, or done.' },
      { type: 'segment', key: 'transcriptView', label: 'Default transcript view', desc: 'How much detail new sessions show.', options: ['Normal', 'Thinking', 'Verbose'] },
      { type: 'heading', label: 'Pull requests' },
      { type: 'toggle', key: 'autoPR', label: 'Open pull requests automatically', desc: 'Open a pull request as soon as the agent pushes changes.' },
      { type: 'toggle', key: 'prDraft', label: 'Open as draft', desc: 'Pull requests the agent opens start as drafts instead of ready for review.', sub: true, dependsOn: 'autoPR' },
      { type: 'toggle', key: 'autoFix', label: 'Auto-fix pull requests', desc: 'Fix failing checks and answer review comments.' },
    ] },
  ];
  let setSection = 'account', checkout = null;

  function rowHTML(r) {
    const P = state.prefs;
    const head = (extra = '') => `<div class="set-text"><b>${esc(r.label)}</b>${r.desc ? `<small>${esc(r.desc)}</small>` : ''}${extra}</div>`;
    const id = 'pref-' + (r.key || r.label || r.type).toString().replace(/\W+/g, '-').toLowerCase();
    switch (r.type) {
      case 'heading': return `<h3 class="set-heading">${esc(r.label)}</h3>`;
      case 'input': return `<div class="set-row">${head()}<input class="set-input" id="${id}" type="${r.inputType || 'text'}" data-pref="${r.key}" value="${esc(P[r.key])}" placeholder="${esc(r.placeholder || '')}" aria-label="${esc(r.label)}"></div>`;
      case 'brand': return `<div class="set-row">${head()}<input class="set-input" id="${id}" data-brandkey="${r.key}" value="${esc(state.brand[r.key])}" maxlength="${r.key === 'name' ? 28 : 32}" aria-label="${esc(r.label)}"></div>`;
      case 'textarea': return `<div class="set-row stack">${head()}<textarea class="set-input set-area" id="${id}" data-pref="${r.key}" rows="4" placeholder="${esc(r.placeholder || '')}" aria-label="${esc(r.label)}">${esc(P[r.key])}</textarea></div>`;
      case 'select': return `<div class="set-row">${head()}<select class="set-input set-select" id="${id}" data-pref="${r.key}" aria-label="${esc(r.label)}">${r.options.map((o) => `<option${o === P[r.key] ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
      case 'toggle': {
        const off = r.dependsOn && !P[r.dependsOn];
        return `<div class="set-row${r.sub ? ' sub' : ''}${off ? ' disabled' : ''}">${head()}<button type="button" class="switch" role="switch" id="${id}" data-pref="${r.key}" aria-checked="${!!P[r.key]}" aria-label="${esc(r.label)}"${off ? ' disabled' : ''}></button></div>`;
      }
      case 'segment': return `<div class="set-row">${head()}<div class="segmented" role="radiogroup" aria-label="${esc(r.label)}">${r.options.map((o) => `<button type="button" role="radio" aria-checked="${o === P[r.key]}" data-seg="${r.key}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>`;
      case 'action': return `<div class="set-row">${head()}<button type="button" class="${r.danger ? 'btn-ghost danger' : 'btn-ghost'}" data-setaction="${esc(r.label)}">${esc(r.button)}</button></div>`;
      case 'skins': return `<div class="set-row stack">${head()}<div class="set-skins">${Object.entries(SKINS).map(([k, v]) => `<button type="button" class="set-skin${state.skin === k ? ' on' : ''}" data-skinpick="${k}"><span class="sp sp-${k}"></span><b>${v.name}</b><small>${v.label}</small></button>`).join('')}</div></div>`;
      case 'model': {
        const own = ownModelActive(), b = AI.backend;
        return `<div class="set-row"><div class="set-text"><b>Model</b><small>${own ? `Using your ${esc(state.model.provider)} model · ${esc(state.model.model)}` : b ? `Built-in AI is online · ${esc(b.provider)} · ${esc(b.model)}${b.free ? ' (free)' : ''}` : 'Offline preview here. Live AI turns on automatically on your Vercel site.'}</small></div><button type="button" class="btn-ghost" data-setaction="model">${own ? 'Use built-in AI' : 'Use your own model'}</button></div>`;
      }
      case 'plan-summary': {
        const pl = planById(state.billing.plan);
        return `<div class="set-row"><div class="set-text"><b>Plan</b><small>${pl.name}${pl.id !== 'free' ? ` · ${state.billing.cycle === 'annual' ? 'Annual' : 'Monthly'} · renews ${fmtDate(state.billing.renews)}` : ' · upgrade any time'}</small></div><button type="button" class="${pl.id === 'free' ? 'btn-primary' : 'btn-ghost'}" data-gosec="billing">${pl.id === 'free' ? 'Upgrade' : 'Manage'}</button></div>`;
      }
      case 'billing': return billingHTML();
      case 'usage': return usageHTML();
      default: return '';
    }
  }
  const rowText = (r) => [r.label, r.desc, r.type === 'billing' ? 'plan subscription upgrade monthly annual pro team free invoice payment peso php gcash maya' : '', r.type === 'usage' ? 'usage messages images videos storage limit' : '', r.type === 'model' ? 'model provider api key connect' : '', r.type === 'plan-summary' ? 'plan upgrade subscription' : '', r.type === 'skins' ? 'interface skin theme glass clay cyber nebula gold matte' : ''].join(' ').toLowerCase();

  function billingHTML() {
    const B = state.billing, cur = planById(B.plan);
    if (checkout) return checkoutHTML();
    const cyc = B.view || B.cycle || 'monthly';
    const cards = PLANS.map((p) => {
      const price = cyc === 'annual' ? p.annual : p.monthly;
      const perMonth = cyc === 'annual' && p.annual ? Math.round(p.annual / 12) : null;
      const isCur = p.id === B.plan && (p.id === 'free' || B.cycle === cyc);
      const btn = isCur ? '<button type="button" class="btn-ghost" disabled>Current plan</button>'
        : p.id === 'free' ? (B.plan === 'free' ? '<button type="button" class="btn-ghost" disabled>Current plan</button>' : '<button type="button" class="btn-ghost" data-plan="free">Switch to Free</button>')
        : `<button type="button" class="${p.popular ? 'btn-primary' : 'btn-ghost'}" data-plan="${p.id}">${B.plan === p.id ? `Switch to ${cyc === 'annual' ? 'annual' : 'monthly'}` : `Upgrade to ${p.name}`}</button>`;
      return `<div class="plan${p.popular ? ' popular' : ''}${isCur ? ' current' : ''}">
        ${p.popular ? '<span class="plan-badge">Most popular</span>' : ''}
        <h4>${p.name}</h4><p class="plan-blurb">${p.blurb}</p>
        <div class="plan-price"><b>${peso(price)}</b><small>${price === 0 ? 'forever' : cyc === 'annual' ? `per ${p.perSeat ? 'member / ' : ''}year` : `per ${p.perSeat ? 'member / ' : ''}month`}</small></div>
        <p class="plan-note">${perMonth ? `${peso(perMonth)}/month billed yearly · save ${peso(p.monthly * 12 - p.annual)}` : p.monthly ? 'Billed monthly · cancel any time' : 'No card needed'}</p>
        ${btn}
        <ul>${p.features.map((f) => `<li>${icon('check')}${esc(f)}</li>`).join('')}</ul>
      </div>`;
    }).join('');
    const inv = B.invoices.length
      ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>${B.invoices.map((i) => `<tr><td>${fmtDate(i.date)}</td><td>${esc(i.desc)}</td><td>${peso(i.amount)}</td><td><span class="pill on">${esc(i.status)}</span></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="set-empty">No invoices yet. They appear here after you upgrade.</p>';
    return `<div class="billing">
      <div class="bill-current">
        <div><small>Current plan</small><b>${cur.name}${cur.id !== 'free' ? ` · ${B.cycle === 'annual' ? 'Annual' : 'Monthly'}` : ''}</b>
        <span>${cur.id === 'free' ? 'Free forever. Upgrade for more messages, images and video.' : `${peso(B.cycle === 'annual' ? cur.annual : cur.monthly)} ${B.cycle === 'annual' ? 'per year' : 'per month'} · renews ${fmtDate(B.renews)} · ${esc(B.method || '')}`}</span></div>
        ${cur.id !== 'free' ? '<button type="button" class="btn-ghost danger" data-billing="cancel">Cancel subscription</button>' : ''}
      </div>
      <div class="cycle" role="radiogroup" aria-label="Billing cycle">
        <button type="button" role="radio" aria-checked="${cyc === 'monthly'}" data-cycle="monthly">Monthly</button>
        <button type="button" role="radio" aria-checked="${cyc === 'annual'}" data-cycle="annual">Annual <em>2 months free</em></button>
      </div>
      <div class="plans">${cards}</div>
      <p class="set-fine">Prices in Philippine pesos (PHP), VAT inclusive. These are sample prices for this white-label build; set your own in <code>assets/app.js</code>.</p>
      <h3 class="set-heading">Billing history</h3>
      ${inv}
    </div>`;
  }

  function checkoutHTML() {
    const p = planById(checkout.plan), cyc = checkout.cycle;
    const amount = cyc === 'annual' ? p.annual : p.monthly;
    const methods = [['GCash', 'Pay with your GCash wallet'], ['Maya', 'Pay with your Maya wallet'], ['Card', 'Visa, Mastercard or JCB'], ['Bank transfer', 'BPI, BDO, UnionBank and more']];
    if (checkout.done) {
      return `<div class="checkout done"><span class="co-ok">${icon('check')}</span><h4>You’re on ${p.name}</h4>
        <p>${peso(amount)} ${cyc === 'annual' ? 'per year' : 'per month'} · renews ${fmtDate(state.billing.renews)}. A receipt was added to your billing history.</p>
        <button type="button" class="btn-primary" data-billing="done">Back to billing</button></div>`;
    }
    return `<div class="checkout">
      <button type="button" class="co-back" data-billing="back">${icon('left')}Plans</button>
      <h4>Upgrade to ${p.name}</h4>
      <div class="co-grid">
        <div class="co-summary">
          <div class="co-line"><span>${p.name} plan · ${cyc === 'annual' ? 'Annual' : 'Monthly'}</span><b>${peso(amount)}</b></div>
          ${cyc === 'annual' ? `<div class="co-line muted"><span>You save vs monthly</span><span>−${peso(p.monthly * 12 - p.annual)}</span></div>` : ''}
          <div class="co-line muted"><span>VAT (12%, included)</span><span>${peso(Math.round(amount - amount / 1.12))}</span></div>
          <div class="co-line total"><span>Due today</span><b>${peso(amount)}</b></div>
          <small>Renews ${cyc === 'annual' ? 'every year' : 'every month'} until you cancel.</small>
        </div>
        <div class="co-methods" role="radiogroup" aria-label="Payment method">
          ${methods.map(([m, d]) => `<button type="button" role="radio" class="co-method" aria-checked="${checkout.method === m}" data-method="${m}"><b>${m}</b><small>${d}</small></button>`).join('')}
        </div>
      </div>
      <p class="co-test">${icon('shield')}Test mode: no payment is taken and no card details are collected. Connect a payment provider such as PayMongo or Stripe to charge real payments.</p>
      <div class="co-actions"><button type="button" class="btn-ghost" data-billing="back">Cancel</button><button type="button" class="btn-primary" data-billing="pay"${checkout.paying ? ' disabled' : ''}>${checkout.paying ? 'Processing…' : `Pay ${peso(amount)} with ${esc(checkout.method)}`}</button></div>
    </div>`;
  }

  function usageHTML() {
    const lim = planById(state.billing.plan).limits;
    const msgs = state.convos.reduce((n, c) => n + c.messages.filter((m) => m.role === 'user').length, 0);
    const imgs = state.artifacts.filter((a) => a.kind === 'png' && a.gen).length;
    const vids = state.artifacts.filter((a) => a.kind === 'webm' && a.gen).length;
    let bytes = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gas:')) bytes += (localStorage.getItem(k) || '').length * 2; } } catch { /* storage unavailable */ }
    const mb = bytes / 1048576;
    const meter = (label, used, max, unit = '') => {
      const pct = Math.min(100, (used / max) * 100);
      return `<div class="meter${pct >= 80 ? ' warn' : ''}"><div class="meter-top"><b>${label}</b><span>${unit === 'MB' ? used.toFixed(2) : used.toLocaleString()} / ${max.toLocaleString()}${unit ? ' ' + unit : ''}</span></div><div class="meter-bar"><i style="width:${Math.max(pct, 1.5)}%"></i></div></div>`;
    };
    const reset = new Date(); reset.setMonth(reset.getMonth() + 1, 1);
    return `<div class="usage">
      <p class="set-fine">${planById(state.billing.plan).name} plan · resets ${fmtDate(reset)}</p>
      ${meter('Messages', msgs, lim.messages)}
      ${meter('Images', imgs, lim.images)}
      ${meter('Videos', vids, lim.videos)}
      ${meter('Storage', mb, lim.storage, 'MB')}
      ${state.billing.plan === 'free' ? '<div class="set-row"><div class="set-text"><b>Need more?</b><small>Pro gives you 40× more messages and 50× more images.</small></div><button type="button" class="btn-primary" data-gosec="billing">See plans</button></div>' : ''}
    </div>`;
  }

  function renderSettings() {
    const q = ($('#setSearch').value || '').trim().toLowerCase();
    $('#setNav').innerHTML = SET_SECTIONS.map((s) => s.sep ? '<hr>' : `<button type="button" class="set-nav-item${!q && s.id === setSection ? ' active' : ''}" data-sec="${s.id}">${icon(s.icon)}<span>${s.label}</span>${s.id === 'billing' && state.billing.plan === 'free' ? '<em>Upgrade</em>' : ''}</button>`).join('');
    const secs = q ? SET_SECTIONS.filter((s) => !s.sep) : SET_SECTIONS.filter((s) => s.id === setSection);
    let html = '';
    for (const s of secs) {
      const rows = q ? s.rows.filter((r) => r.type !== 'heading' && (rowText(r).includes(q) || s.label.toLowerCase().includes(q))) : s.rows;
      if (!rows.length) continue;
      html += `<section class="set-sec"><h2>${s.label}</h2>${rows.map(rowHTML).join('')}</section>`;
    }
    $('#setBody').innerHTML = html || `<p class="set-empty">No settings match “${esc(q)}”.</p>`;
    $('#setBody').scrollTop = 0;
  }
  function openSettings(section) {
    if (section && typeof section === 'string') setSection = section;
    checkout = null; $('#setSearch').value = '';
    renderSettings(); openModal('settingsModal');
  }
  function setPref(key, val) {
    state.prefs[key] = val; savePrefs(); applyPrefs(key);
  }
  function applyPrefs(changed) {
    const P = state.prefs;
    document.body.dataset.fs = P.fontSize.toLowerCase();
    reduced = P.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.body.classList.toggle('calm', !!P.reduceMotion);
    if (!changed || changed === 'defaultMode') { state.mode = P.defaultMode; $('#modeName').textContent = P.defaultMode; }
    if (!changed || changed === 'autoApproveDefault') { state.auto = !!P.autoApproveDefault; $('#autoBtn').setAttribute('aria-pressed', state.auto); }
    if (changed === 'saveHistory' && !P.saveHistory) { try { localStorage.removeItem('gas:convos'); } catch { /* storage unavailable */ } }
    if (changed === 'saveHistory' && P.saveHistory) save();
  }
  function exportChats() {
    try {
      const blob = new Blob([JSON.stringify(state.convos.map(({ id, title, updated, messages, pinned, archived, projectId }) => ({ id, title, updated: new Date(updated).toISOString(), pinned: !!pinned, archived: !!archived, projectId: projectId || null, messages: messages.map((m) => ({ role: m.role, text: m.text || m.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() })) })), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `${state.brand.name.replace(/\W+/g, '-').toLowerCase()}-chats.json`; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000); toast(`Exported ${state.convos.length} chats`, 'download');
    } catch { toast('Export was blocked by the browser.', 'x'); }
  }
  function clearChats() {
    const body = $('#setBody'); const row = body.querySelector('[data-setaction="Clear all chats"]')?.closest('.set-row'); if (!row) return;
    if (row.classList.contains('confirming')) return;
    row.classList.add('confirming');
    row.insertAdjacentHTML('beforeend', `<div class="set-confirm"><span>Delete all ${state.convos.length} chats?</span><button type="button" class="btn-ghost" data-confirm="no">Cancel</button><button type="button" class="btn-danger" data-confirm="yes">${icon('trash')}Delete all</button></div>`);
  }

  function bindSettings() {
    $('#setSearch').addEventListener('input', renderSettings);
    $('#setNav').addEventListener('click', (e) => { const b = e.target.closest('[data-sec]'); if (!b) return; setSection = b.dataset.sec; checkout = null; $('#setSearch').value = ''; renderSettings(); });
    const body = $('#setBody');
    body.addEventListener('input', (e) => {
      const el = e.target;
      if (el.dataset.pref && el.tagName !== 'SELECT') { state.prefs[el.dataset.pref] = el.value; savePrefs(); }
      if (el.dataset.brandkey) { state.brand[el.dataset.brandkey] = el.value.trim() || DEFAULT_BRAND[el.dataset.brandkey]; store.set('brand', state.brand); applyBrand(); }
    });
    body.addEventListener('change', (e) => {
      const el = e.target;
      if (el.tagName === 'SELECT' && el.dataset.pref) { setPref(el.dataset.pref, el.value); toast('Saved'); }
      if (el.dataset.pref && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) toast('Saved');
      if (el.dataset.pref === 'displayName') paintGreeting();
      if (el.dataset.brandkey) toast('Brand updated');
    });
    body.addEventListener('click', async (e) => {
      const t = e.target;
      const sw = t.closest('.switch[data-pref]');
      if (sw && !sw.disabled) { const k = sw.dataset.pref; setPref(k, !state.prefs[k]); const scroll = body.scrollTop; renderSettings(); body.scrollTop = scroll; return; }
      const seg = t.closest('[data-seg]');
      if (seg) { setPref(seg.dataset.seg, seg.dataset.val); $$(`[data-seg="${seg.dataset.seg}"]`, body).forEach((b) => b.setAttribute('aria-checked', b === seg)); return; }
      const sk = t.closest('[data-skinpick]');
      if (sk) { location.hash = sk.dataset.skinpick; setTimeout(() => openSettings('appearance'), 60); return; }
      const go = t.closest('[data-gosec]');
      if (go) { setSection = go.dataset.gosec; checkout = null; $('#setSearch').value = ''; renderSettings(); return; }
      const act = t.closest('[data-setaction]');
      if (act) {
        const k = act.dataset.setaction;
        if (k === 'model') { if (ownModelActive()) { disconnectModel(); renderSettings(); } else { closeModals(); openModel(); } return; }
        const r = SET_SECTIONS.flatMap((s) => s.rows || []).find((x) => x.label === k); r && r.run(); return;
      }
      const cf = t.closest('[data-confirm]');
      if (cf) {
        if (cf.dataset.confirm === 'yes') { const n = state.convos.length; state.convos = []; state.current = null; save(); newChat(); toast(`Deleted ${n} chats`, 'trash'); log('Cleared all chats'); }
        renderSettings(); return;
      }
      const cy = t.closest('[data-cycle]');
      if (cy) { state.billing.view = cy.dataset.cycle; renderSettings(); return; }
      const pl = t.closest('[data-plan]');
      if (pl) {
        if (pl.dataset.plan === 'free') { state.billing.plan = 'free'; state.billing.renews = null; state.billing.method = ''; saveBilling(); checkout = null; toast('Switched to the Free plan'); log('Plan changed to Free'); renderSettings(); return; }
        checkout = { plan: pl.dataset.plan, cycle: state.billing.view || 'monthly', method: 'GCash' }; renderSettings(); return;
      }
      const m = t.closest('[data-method]');
      if (m) { checkout.method = m.dataset.method; renderSettings(); return; }
      const bl = t.closest('[data-billing]');
      if (!bl) return;
      const a = bl.dataset.billing;
      if (a === 'back' || a === 'done') { checkout = null; renderSettings(); return; }
      if (a === 'pay') {
        checkout.paying = true; renderSettings();
        await sleep(reduced ? 50 : 1300);
        const p = planById(checkout.plan); const amount = checkout.cycle === 'annual' ? p.annual : p.monthly;
        const renews = new Date(); if (checkout.cycle === 'annual') renews.setFullYear(renews.getFullYear() + 1); else renews.setMonth(renews.getMonth() + 1);
        Object.assign(state.billing, { plan: p.id, cycle: checkout.cycle, view: checkout.cycle, renews: renews.getTime(), method: checkout.method });
        state.billing.invoices.unshift({ date: now(), desc: `${p.name} plan · ${checkout.cycle === 'annual' ? 'Annual' : 'Monthly'} (${checkout.method})`, amount, status: 'Paid · test' });
        saveBilling(); paintPlan(); checkout.paying = false; checkout.done = true; renderSettings();
        toast(`Upgraded to ${p.name}`, 'check'); log(`Upgraded to ${p.name} (${checkout.cycle}, test mode)`);
        return;
      }
      if (a === 'cancel') {
        const row = bl.closest('.bill-current');
        if (!row.querySelector('.set-confirm')) row.insertAdjacentHTML('beforeend', `<div class="set-confirm"><span>Cancel ${planById(state.billing.plan).name}? You keep it until ${fmtDate(state.billing.renews)} in a real setup; in this demo it ends now.</span><button type="button" class="btn-ghost" data-billing="keep">Keep plan</button><button type="button" class="btn-danger" data-billing="confirm-cancel">Cancel plan</button></div>`);
        return;
      }
      if (a === 'keep') { renderSettings(); return; }
      if (a === 'confirm-cancel') { state.billing.plan = 'free'; state.billing.renews = null; saveBilling(); paintPlan(); toast('Subscription cancelled'); log('Subscription cancelled'); renderSettings(); }
    });
  }
  function paintPlan() {
    const p = planById(state.billing.plan);
    $('#planName').textContent = `${p.name} plan`;
    $('#planCta').textContent = p.id === 'free' ? 'Upgrade' : 'Manage';
    $('#planChip').classList.toggle('paid', p.id !== 'free');
  }

  /* Folder & files */
  function pickFolder() { $('#folderInput').click(); }
  function onFolder(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const root = (files[0].webkitRelativePath || files[0].name).split('/')[0] || 'folder';
    const fmt = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
    state.workspace = { name: root, files: files.map((f) => ({ name: (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name, size: fmt(f.size) })) };
    $('#folderName').textContent = root;
    toast(`Opened “${root}” · ${files.length} files`, 'folder');
    log(`Opened local folder "${root}" (${files.length} files)`);
    if (state.section === 'code') renderSection('code');
    e.target.value = '';
  }
  async function onFiles(e) {
    const files = Array.from(e.target.files || []); e.target.value = '';
    const textLike = (f) => /^text\/|json|xml|javascript|csv|markdown|x-sh|x-python|php|sql|yaml/.test(f.type) || /\.(txt|md|csv|tsv|json|js|mjs|ts|jsx|tsx|py|php|html?|css|scss|sql|xml|ya?ml|java|kt|c|h|cpp|cs|go|rs|rb|sh|log|ini|toml|env|vue|svelte)$/i.test(f.name);
    for (const f of files) {
      let text = '';
      if (textLike(f) && f.size < 300000) { try { text = (await f.text()).slice(0, 100000); } catch { /* unreadable */ } }
      state.attachments.push({ name: f.name, text });
    }
    renderAttachments();
    if (files.length) toast(`${files.length} file${files.length > 1 ? 's' : ''} attached${files.some((f) => textLike(f)) ? ' · the agent can read the text' : ''}`, 'clip');
    $('#prompt').focus();
  }

  /* Voice */
  let recog = null;
  function toggleMic() {
    const btn = $('#micBtn');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (recog) { recog.stop(); return; }
    if (!SR) { toast('Voice input is not available in this browser. Try Chrome or Edge.', 'mic'); return; }
    try {
      recog = new SR(); recog.lang = navigator.language || 'en-US'; recog.interimResults = true;
      const base = $('#prompt').value;
      recog.onresult = (ev) => { $('#prompt').value = (base ? base + ' ' : '') + Array.from(ev.results).map((r) => r[0].transcript).join(''); autosize(); };
      recog.onerror = () => toast('Microphone access was blocked. Allow it in your browser settings.', 'mic');
      recog.onend = () => { recog = null; btn.setAttribute('aria-pressed', 'false'); };
      recog.start(); btn.setAttribute('aria-pressed', 'true');
    } catch { recog = null; toast('Voice input could not start.', 'mic'); }
  }

  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg, 'copy'); }
    catch { toast('Copy was blocked. Select the address bar and copy it instead.', 'x'); }
  }

  /* ---------------- Tour ---------------- */
  const TOUR = [
    { sel: '.sidebar', title: 'Your workspace', text: 'Start new chats, find recent ones, and jump to Code, Projects, Artifacts, Scheduled tasks, the Team room and Agents.' },
    { sel: '#roleBtn', title: 'Job model', text: 'Pick a role such as Accountant, Tax Associate or Agronomist. The AI takes on that role, and the quick actions and tools below the message box change to match it.' },
    { sel: '#proKit', title: 'Role tools', text: 'Each role has working calculators and tools. Results update as you type; ask the AI to explain them, copy them or save them to Artifacts.' },
    { sel: '#modelBtn', title: 'Model', text: 'Auto uses the built-in AI. Choose “Use your own model” to plug in your own API key or a local model.' },
    { sel: '.composer', title: 'Ask anything', text: 'Attach files, generate images and videos with the + button, pick a folder, switch modes, use your voice and choose whether the agent can act without asking.' },
    { sel: '.skin-btn', title: 'Switch interface', text: 'Jump between all seven interfaces at any time. Your chats and settings come with you.' },
    { sel: '.home-btn', title: 'Back home', text: 'Return to the studio home page to compare and choose another interface.' },
  ];
  let tourI = -1;
  function startTour() {
    showSection('chat');
    if (current() && current().messages.length) newChat();
    closeNav();
    tourI = -1; $('#tour').hidden = false; nextTour();
  }
  function visible(el) { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth; }
  function nextTour() {
    do { tourI++; } while (tourI < TOUR.length && !visible($(TOUR[tourI].sel)));
    if (tourI >= TOUR.length) { endTour(); toast('Tour finished'); return; }
    const s = TOUR[tourI]; const r = $(s.sel).getBoundingClientRect();
    const ring = $('#tourRing'); const pad = 6;
    Object.assign(ring.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    $('#tourStep').textContent = `Step ${tourI + 1} of ${TOUR.length}`;
    $('#tourTitle').textContent = s.title; $('#tourText').textContent = s.text;
    $('#tourNext').textContent = tourI === TOUR.length - 1 ? 'Done' : 'Next';
    const pop = $('#tourPop'); const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = r.right + 16, top = r.top;
    if (left + pw > window.innerWidth - 12) { left = Math.min(Math.max(12, r.left), window.innerWidth - pw - 12); top = r.bottom + 16; }
    if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 16);
    pop.style.left = left + 'px'; pop.style.top = Math.max(12, top) + 'px';
    $('#tourNext').focus();
  }
  function endTour() { $('#tour').hidden = true; tourI = -1; }

  /* ---------------- Studio launcher ---------------- */
  function initStudio() {
    $('#wlName').value = state.brand.name === DEFAULT_BRAND.name ? '' : state.brand.name;
    $('#wlTag').value = state.brand.tagline === DEFAULT_BRAND.tagline ? '' : state.brand.tagline;
    $('#wlForm').addEventListener('submit', (e) => {
      e.preventDefault();
      state.brand.name = $('#wlName').value.trim() || DEFAULT_BRAND.name;
      state.brand.tagline = $('#wlTag').value.trim() || DEFAULT_BRAND.tagline;
      store.set('brand', state.brand); applyBrand();
      toast(`Name set to ${state.brand.name}`);
    });
    $('#wlReset').addEventListener('click', () => {
      state.brand = Object.assign({}, DEFAULT_BRAND); store.set('brand', state.brand);
      $('#wlName').value = ''; $('#wlTag').value = ''; applyBrand();
      toast('Reset to GAS Agent');
    });
    $('#copyLogo').addEventListener('click', () => copy(STANDALONE_LOGO, 'Logo SVG copied'));
  }

  /* ---------------- Events ---------------- */
  function bind() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]');
      const sec = e.target.closest('.nav [data-section]');
      const cbBtn = e.target.closest('[data-cb]');
      if (cbBtn) { codeAction(cbBtn); return; }
      const exp = e.target.closest('.msg [data-export]');
      if (exp) { const m = exp.closest('.msg'); exportDoc(exp.dataset.export, m._md, m._title); return; }
      const ma = e.target.closest('.msg [data-msgact="copy"]');
      if (ma) { copy(ma.closest('.msg')._md, 'Reply copied'); return; }
      if (e.target.closest('[data-retry]')) { retryLast(); return; }
      const cmenu = e.target.closest('[data-convo-menu]');
      if (cmenu) { e.preventDefault(); convoMenu(cmenu); return; }
      const conv = e.target.closest('[data-convo]');
      const art = e.target.closest('[data-artifact]');
      const rm = e.target.closest('[data-rm]');
      const pal = e.target.closest('#palList [role=option]');
      const inPopover = e.composedPath().includes($('#popover'));
      if (!inPopover && !e.target.closest('[data-action$="-menu"], [data-action="notifications"], [data-convo-menu]')) closePopover();
      if (inPopover) return;
      if (e.target.closest('.home-btn')) { closeNav(); }
      if (pal) { palRun(+pal.dataset.i); return; }
      if (rm) { state.attachments.splice(+rm.dataset.rm, 1); renderAttachments(); return; }
      if (art) { showSection('artifacts'); renderSection('artifacts', art.dataset.artifact); return; }
      if (conv) { openConvo(conv.dataset.convo); return; }
      if (sec) { showSection(sec.dataset.section); return; }
      if (e.target.classList.contains('modal')) { closeModals(); return; }
      if (!a) return;
      const act = a.dataset.action;
      const map = {
        'new-chat': newChat,
        'show-archived': () => { state.showArchived = true; renderRecents(); },
        'hide-archived': () => { state.showArchived = false; renderRecents(); },
        'toggle-sidebar': toggleSidebar,
        'open-nav': openNav,
        'close-nav': closeNav,
        'setup-model': openModel,
        'close-modal': closeModals,
        'settings': () => openSettings(),
        'upgrade': () => openSettings('billing'),
        'palette': openPalette,
        'tour': startTour,
        'tour-next': nextTour,
        'tour-end': endTour,
        'open-folder': pickFolder,
        'attach': () => $('#fileInput').click(),
        'mode-menu': () => modeMenu(a),
        'skin-menu': () => skinMenu(a),
        'plus-menu': () => plusMenu(a),
        'model-menu': () => modelMenu(a),
        'notifications': () => notifMenu(a),
        'mic': toggleMic,
        'share': () => copy(location.href, 'Link copied'),
        'activity': () => { const d = $('#activity'); d.hidden = !d.hidden; if (!d.hidden) renderLog(); },
        'voice': () => { state.voice = !state.voice; a.setAttribute('aria-pressed', state.voice); if (!state.voice && 'speechSynthesis' in window) speechSynthesis.cancel(); toast(state.voice ? 'Replies will be read aloud' : 'Read aloud is off', 'volume'); },
        'auto': () => { state.auto = !state.auto; a.setAttribute('aria-pressed', state.auto); toast(state.auto ? 'Auto-approve on: the agent acts without asking' : 'Auto-approve off: the agent asks first'); log(`Auto-approve ${state.auto ? 'on' : 'off'}`); },
      };
      if (map[act]) { e.preventDefault(); map[act](); }
      else if (window.GASPro && window.GASPro.action(act, a)) e.preventDefault();
    });

    $('#composer').addEventListener('submit', (e) => { e.preventDefault(); send(); });
    $('#prompt').addEventListener('input', () => { autosize(); Core.listen(); });
    $('#prompt').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!AI.ctrl) send(); }
    });
    $$('.suggest').forEach((b) => b.addEventListener('click', () => send(b.textContent.trim())));
    $('#recentSearch').addEventListener('input', renderRecents);
    $('#recents').addEventListener('contextmenu', (e) => {
      const row = e.target.closest('[data-row]'); if (!row) return;
      e.preventDefault(); const btn = $('[data-convo-menu]', row); closePopover(); convoMenu(btn);
    });
    $('#modelForm').addEventListener('submit', connectModel);
    $('#providers').addEventListener('click', (e) => {
      const b = e.target.closest('[data-prov]'); if (!b) return;
      provSel = PROVIDERS.find((p) => p.id === b.dataset.prov); paintProv(); $('#modelError').textContent = '';
    });
    bindSettings();
    $('#palInput').addEventListener('input', renderPalette);
    $('#palInput').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); palMove(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palMove(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); palRun(palIdx); }
    });
    $('#folderInput').addEventListener('change', onFolder);
    $('#fileInput').addEventListener('change', onFiles);

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (!state.skin) return;
        e.preventDefault();
        if ($('#palette').hidden) openPalette(); else closeModals();
      } else if (e.key === 'Escape') {
        if (!$('#tour').hidden) endTour();
        else if (!$('#popover').hidden) closePopover();
        else if ($$('.modal').some((m) => !m.hidden)) closeModals();
        else if (!$('#activity').hidden) $('#activity').hidden = true;
        else closeNav();
      }
    });
    window.addEventListener('resize', () => { closePopover(); if (tourI >= 0) { tourI--; nextTour(); } });
    window.addEventListener('hashchange', route);
  }

  /* ---------------- Init ---------------- */
  paintLogos();
  if (store.get('collapsed', false) && !window.matchMedia('(max-width: 860px)').matches) $('#app').classList.add('collapsed');
  bind();
  applyPrefs();
  paintPlan();
  initStudio();
  paintModel();
  checkBackend();
  window.addEventListener('load', () => highlight(document));
  if (window.GASPro) {
    window.GASPro.init({
      state, store, $, $$, esc, icon, toast, log, md, sleep, save, send, newChat, openConvo, showSection, renderRecents,
      popover, closePopover, openSettings, openPalette, pickFolder, startTour, autosize, paintLogos, applyBrand, copy, downloadText, openCode,
      current, aiAvailable: () => aiAvailable(), skins: SKINS,
    });
  }
  renderRecents();
  renderThread();
  log('Session started');
  route();
})();

/* GAS Agent — white-label interface behavior (shared by all skins) */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const icon = (id, cls = '') => `<svg class="ico ${cls}"><use href="#i-${id}"/></svg>`;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('gas:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('gas:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  const SKINS = {
    glass: { name: 'Glass', label: 'Glassmorphism' },
    clay: { name: 'Clay', label: 'Claymorphism' },
    cyber: { name: 'Cyber', label: 'Cybersecurity' },
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
    id: 'c-hello', title: 'hello', updated: now() - 60 * 1000,
    messages: [
      { role: 'user', text: 'hello' },
      { role: 'ai', html: `<p>Hello! I'm <span data-brand="name">${esc(DEFAULT_BRAND.name)}</span>. I can chat, work with files in your workspace, and create documents, spreadsheets, PDFs and images. What should we start with?</p>` },
    ],
  }];

  const state = {
    brand: Object.assign({}, DEFAULT_BRAND, store.get('brand', {})),
    model: store.get('model', null),
    convos: store.get('convos', null) || seedConvos(),
    artifacts: store.get('artifacts', null) || [
      { name: 'Board update.docx', kind: 'docx', meta: 'Word document · 2 pages', time: now() - 86400e3 * 2 },
      { name: 'Hiring plan.xlsx', kind: 'xlsx', meta: 'Spreadsheet · 3 sheets', time: now() - 86400e3 * 5 },
      { name: 'Product one-pager.pdf', kind: 'pdf', meta: 'PDF · 1 page', time: now() - 86400e3 * 9 },
      { name: 'Launch banner.png', kind: 'png', meta: 'Image · 1600 × 900', time: now() - 86400e3 * 12 },
    ],
    current: null,
    skin: null,
    section: 'chat',
    mode: 'Normal',
    choice: 'Auto',
    auto: false,
    voice: false,
    workspace: { name: 'assistant', files: null },
    attachments: [],
    busy: false,
    log: [],
  };
  state.current = null;

  const save = () => {
    store.set('convos', state.convos.slice(0, 40));
    store.set('artifacts', state.artifacts.slice(0, 40));
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
  function applyBrand() {
    const { name, tagline } = state.brand;
    $$('[data-brand="name"]').forEach((el) => { el.textContent = name; });
    $$('[data-brand="tagline"]').forEach((el) => { el.textContent = tagline; });
    $$('[data-brand="slug"]').forEach((el) => { el.textContent = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent'; });
    document.title = state.skin ? `${name} · ${SKINS[state.skin].name}` : `${name} Studio`;
  }

  /* ---------------- Toasts & log ---------------- */
  function toast(msg, ico = 'check') {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `${icon(ico)}<span>${esc(msg)}</span>`;
    $('#toasts').append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 2600);
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

  /* ---------------- Greeting ---------------- */
  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }
  function paintGreeting() {
    const g = greeting();
    const el = $('#greetText');
    el.textContent = g; el.dataset.text = g;
  }

  /* ---------------- Router: launcher <-> skins ---------------- */
  let bootedCyber = false;
  function route() {
    const h = location.hash.replace('#', '');
    closeAllOverlays();
    if (SKINS[h]) openSkin(h); else openLauncher();
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
    if (changed) log(`Switched to ${SKINS[id].name} interface`);
    if (id === 'cyber') { startClock(); if (!bootedCyber) { bootedCyber = true; boot(); } } else stopClock();
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
      `> model link: ${state.model ? state.model.provider.toUpperCase() + ' ..... ONLINE' : 'none ............ STANDBY'}`,
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
  function renderRecents() {
    const q = $('#recentSearch').value.trim().toLowerCase();
    const list = state.convos.slice().sort((a, b) => b.updated - a.updated)
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => (m.text || '').toLowerCase().includes(q)));
    $('#recents').innerHTML = list.length
      ? list.map((c) => `<button class="recent${c.id === state.current && state.section === 'chat' ? ' active' : ''}" data-convo="${c.id}"><b>${esc(c.title)}</b><small>${relTime(c.updated)}</small></button>`).join('')
      : `<p class="recents-empty">${q ? 'No chats match that search.' : 'Your chats will show up here.'}</p>`;
    $('#artifactCount').textContent = state.artifacts.length || '';
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
      items: () => state.projects },
    artifacts: { title: 'Artifacts', sub: 'Workspace · Artifacts', icon: 'grid', desc: 'Documents, spreadsheets, PDFs and images the agent has created. New files from chat appear here.', action: 'Create in chat', run: () => newChat(),
      items: () => state.artifacts.map((a) => ({ ico: { docx: 'file', xlsx: 'sheet', pdf: 'file', png: 'image' }[a.kind] || 'file', c: { docx: 'c1', xlsx: 'c2', pdf: 'c4', png: 'c3' }[a.kind], title: a.name, text: a.meta, foot: relTime(a.time), id: a.name })) },
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
  state.projects = [
    { ico: 'folder', c: 'c3', title: 'Q4 planning', text: '12 chats · 8 files · goals, budget and hiring', foot: 'Updated today' },
    { ico: 'folder', c: 'c1', title: 'Client onboarding', text: '5 chats · 14 files · templates and checklists', foot: 'Updated 2 days ago' },
    { ico: 'folder', c: 'c2', title: 'Research notes', text: '9 chats · 22 files · market and competitor notes', foot: 'Updated last week' },
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

  function renderSection(id, flash) {
    const s = SECTIONS[id];
    $('#viewTitle').textContent = s.title;
    $('#viewSub').textContent = s.sub;
    const items = s.items();
    const cards = items.map((it, i) => {
      const tag = it.toggle ? 'div' : 'button';
      return `<${tag} class="card${flash && it.id === flash ? ' flash' : ''}" style="animation-delay:${i * 40}ms" data-card="${i}">
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
    $$('#sectionInner [data-toggle]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const it = items[+b.dataset.toggle]; it.on = !it.on;
      b.setAttribute('aria-checked', it.on);
      toast(`${it.title} turned ${it.on ? 'on' : 'off'}`);
      log(`${it.title} ${it.on ? 'enabled' : 'disabled'}`);
    }));
    $$('#sectionInner button.card').forEach((c) => c.addEventListener('click', () => {
      const it = items[+c.dataset.card];
      if (id === 'artifacts') toast(`${it.title} is ready to open in the desktop app`, 'file');
      else if (id === 'projects' || id === 'team') { newChat(); $('#prompt').value = `Let's continue with "${it.title}". `; autosize(); $('#prompt').focus(); }
      else if (id === 'code') { newChat(); $('#prompt').value = `In ${it.title}, `; autosize(); $('#prompt').focus(); }
    }));
  }

  function addProject() {
    const n = state.projects.length + 1;
    state.projects.unshift({ ico: 'folder', c: ['c1', 'c2', 'c3', 'c4'][n % 4], title: `New project ${n}`, text: '0 chats · 0 files · add instructions to start', foot: 'Created just now' });
    renderSection('projects'); toast('Project created'); log(`Created project "New project ${n}"`);
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
    state.current = null;
    state.attachments = [];
    renderAttachments();
    showSection('chat');
    renderThread();
    $('#prompt').focus({ preventScroll: true });
  }
  function openConvo(id) {
    state.current = id;
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
    scrollDown(true);
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
    }
    el.style.animation = 'none';
    return el;
  }
  function scrollDown(instant) {
    const sc = $('#chatScroll');
    sc.scrollTo({ top: sc.scrollHeight, behavior: instant || reduced ? 'auto' : 'smooth' });
  }

  function makeReply(text, files) {
    const t = text.toLowerCase();
    const B = [];
    const brand = state.brand.name;
    if (!state.model) B.push({ type: 'note', text: 'Preview reply: no model is connected yet, so this answer is a sample. Use Set up a model to get real answers.' });
    if (state.mode === 'Plan') B.push({ type: 'p', text: 'Plan mode is on, so here is the plan before I touch anything.' });
    if (files && files.length) B.push({ type: 'p', text: `I received ${files.length} attachment${files.length > 1 ? 's' : ''}: ${files.join(', ')}. I'll use ${files.length > 1 ? 'them' : 'it'} as context.` });

    if (/word|docx|summary|one-page|document/.test(t)) {
      B.push({ type: 'p', text: 'Here is a one-page summary structure. I filled it with a clear headline, three key points, risks and next steps, then saved it as a Word document in your workspace.' });
      B.push({ type: 'list', items: ['Headline and one-sentence takeaway', 'Three key points with supporting facts', 'Risks and open questions', 'Next steps with owners and dates'] });
      B.push({ type: 'file', name: 'One-page summary.docx', kind: 'docx', meta: `Word document · 1 page · saved to ${state.workspace.name}/` });
      B.push({ type: 'p', text: 'Tell me the topic and I will rewrite the content around it.' });
    } else if (/excel|xlsx|tracker|spreadsheet|priorit/.test(t)) {
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
      B.push({ type: 'p', text: `Here's how I would approach "${short}":` });
      B.push({ type: 'list', items: ['Clarify the goal and what a good result looks like', 'Gather what I need from your workspace files', 'Draft the result and save it where you can find it'] });
      B.push({ type: 'p', text: state.auto ? 'Auto-approve is on, so I will go ahead with file changes without asking.' : 'I will ask before creating or changing any files. Shall I start?' });
    }
    if (state.mode === 'Quick') return B.filter((b) => b.type !== 'list').slice(0, 3);
    return B;
  }

  function blockHTML(b) {
    switch (b.type) {
      case 'p': return `<p>${esc(b.text)}</p>`;
      case 'note': return `<p class="note">${esc(b.text)}</p>`;
      case 'list': return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
      case 'file': return `<div class="file-card"><span class="fc-ico ${b.kind}">${icon(b.kind === 'xlsx' ? 'sheet' : 'file')}</span><span class="fc-text"><b>${esc(b.name)}</b><small>${esc(b.meta)}</small></span><button class="fc-open" data-artifact="${esc(b.name)}">Open</button></div>`;
      case 'table': return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${Array.isArray(c) ? `<span class="pill ${c[0]}">${esc(c[1])}</span>` : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      case 'files': return `<ul class="flist">${b.items.map((f) => `<li>${icon(/\/$/.test(f.name) ? 'folder' : 'file')}<span>${esc(f.name)}</span><small>${esc(f.size || '')}</small></li>`).join('')}</ul>`;
      default: return '';
    }
  }

  async function send(raw) {
    const text = (raw ?? $('#prompt').value).trim();
    if (!text || state.busy) return;
    state.busy = true;
    $('#sendBtn').disabled = true;
    let c = current();
    if (!c) {
      c = { id: 'c-' + now().toString(36), title: text.length > 42 ? text.slice(0, 40) + '…' : text, updated: now(), messages: [] };
      state.convos.unshift(c);
      state.current = c.id;
    }
    const files = state.attachments.map((f) => f.name);
    c.messages.push({ role: 'user', text, files });
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
    await sleep(reduced ? 50 : 650 + Math.random() * 500);

    const blocks = makeReply(text, files);
    const body = $('.body', holder);
    body.innerHTML = '';
    for (const b of blocks) {
      if ((b.type === 'p') && !reduced) {
        const p = document.createElement('p'); p.className = 'caret'; body.append(p);
        for (let i = 0; i <= b.text.length; i += 3) { p.textContent = b.text.slice(0, i); if (i % 30 === 0) scrollDown(true); await sleep(10); }
        p.textContent = b.text; p.classList.remove('caret');
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
      state.artifacts.unshift({ name: b.name, kind: b.kind, meta: b.meta.split(' · saved')[0], time: now() });
      log(`Created ${b.name}`);
    });
    save(); renderRecents();
    if (state.voice && 'speechSynthesis' in window) {
      try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(blocks.filter((b) => b.type === 'p').map((b) => b.text).join(' '))); } catch { /* speech unavailable */ }
    }
    if (state.skin === 'cyber') $('#cyState').textContent = state.model ? 'link online' : 'awaiting model';
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
    state.model = { providerId: provSel.id, provider: provSel.name, model };
    store.set('model', state.model);
    state.choice = model;
    closeModals();
    paintModel();
    toast(`Connected to ${provSel.name}`);
    log(`Model connected: ${provSel.name} / ${model}`);
  }
  function disconnectModel() {
    state.model = null; state.choice = 'Auto';
    store.set('model', null);
    paintModel();
    toast('Model disconnected', 'x');
    log('Model disconnected');
  }
  function paintModel() {
    const m = state.model;
    $('#connectCard').hidden = !!m;
    $('#modelName').textContent = m ? (state.choice === 'Auto' ? 'Auto' : state.choice) : 'Auto';
    $('#modelDot').classList.toggle('on', !!m);
    $('#stModel').textContent = m ? `Model: ${m.provider}` : 'Model: none';
    $('#cyState').textContent = m ? 'link online' : 'awaiting model';
    $('#setModelState').textContent = m ? `${m.provider} · ${m.model}` : 'Not connected';
    $('#setModelBtn').textContent = m ? 'Disconnect' : 'Set up';
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
    pop.onclick = (e) => { const b = e.target.closest('[data-pick]'); if (b) { onClick && onClick(b.dataset.pick); closePopover(); } };
  }
  function closePopover() { const p = $('#popover'); p.hidden = true; p._anchor = null; }

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
    const opts = [['Auto', 'Picks the best model for each task']];
    if (state.model) opts.push([state.model.model, `${state.model.provider} · connected`]);
    popover(a, `<p class="pop-title">Model</p>` + opts.map(([n, d]) => `<button class="pop-item" data-pick="${esc(n)}">${icon('cpu')}<span><b>${esc(n)}</b><small>${esc(d)}</small></span>${state.choice === n ? icon('check', 'chk') : ''}</button>`).join('')
      + `<button class="pop-item" data-pick="__setup">${icon('key')}<span><b>${state.model ? 'Change provider' : 'Set up a model'}</b><small>OpenRouter, OpenAI, Anthropic, Gemini, LM Studio, Ollama</small></span></button>`,
      (v) => { if (v === '__setup') openModel(); else { state.choice = v; paintModel(); } });
  }
  function notifMenu(a) {
    $('#bellBtn').classList.remove('has-dot');
    popover(a, `<p class="pop-title">Notifications</p>
      <button class="pop-item" data-pick="model">${icon('key')}<span><b>${state.model ? 'Model connected' : 'Connect a model'}</b><small>${state.model ? esc(state.model.provider + ' is ready for chats') : 'Answers are samples until a model is connected'}</small></span></button>
      <button class="pop-item" data-pick="scheduled">${icon('clock')}<span><b>Weekly status report</b><small>Runs Friday at 16:00</small></span></button>
      <button class="pop-item" data-pick="team">${icon('users')}<span><b>Amira shared “Design review”</b><small>Team room · 5 min ago</small></span></button>`,
      (v) => { if (v === 'model') { if (!state.model) openModel(); } else showSection(v); });
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
      { g: 'Actions', label: 'Settings', ico: 'settings', run: openSettings },
      { g: 'Actions', label: 'Guide & tour', ico: 'compass', run: startTour },
      ...Object.entries(SECTIONS).map(([k, s]) => ({ g: 'Go to', label: s.title, ico: s.icon, run: () => showSection(k) })),
      ...Object.entries(SKINS).map(([k, s]) => ({ g: 'Interface', label: `${s.name} interface`, ico: 'layers', hint: s.label, run: () => { location.hash = k; } })),
      { g: 'Interface', label: 'Back to studio', ico: 'home', run: () => { location.hash = ''; } },
      ...state.convos.map((c) => ({ g: 'Chats', label: c.title, ico: 'search', hint: relTime(c.updated), run: () => openConvo(c.id) })),
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

  /* Settings */
  function openSettings() {
    $('#setName').value = state.brand.name;
    $('#setTag').value = state.brand.tagline;
    $$('#settingsForm [name=skin]').forEach((r) => { r.checked = r.value === state.skin; });
    paintModel();
    openModal('settingsModal');
  }
  function saveSettings(e) {
    e.preventDefault();
    state.brand.name = $('#setName').value.trim() || DEFAULT_BRAND.name;
    state.brand.tagline = $('#setTag').value.trim() || DEFAULT_BRAND.tagline;
    store.set('brand', state.brand);
    applyBrand();
    const skin = ($('#settingsForm [name=skin]:checked') || {}).value;
    closeModals();
    toast('Settings saved');
    log(`Brand set to "${state.brand.name}"`);
    if (skin && skin !== state.skin) location.hash = skin;
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
  function onFiles(e) {
    const files = Array.from(e.target.files || []);
    state.attachments.push(...files.map((f) => ({ name: f.name })));
    renderAttachments();
    if (files.length) toast(`${files.length} file${files.length > 1 ? 's' : ''} attached`, 'clip');
    e.target.value = '';
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
    { sel: '#connectCard', title: 'Connect a model', text: 'Bring your own key from OpenRouter, OpenAI, Anthropic or Gemini, or run locally with LM Studio or Ollama.' },
    { sel: '.composer', title: 'Ask anything', text: 'Attach files, pick a folder, switch modes, use your voice and choose whether the agent can act without asking.' },
    { sel: '.skin-switch', title: 'Switch interface', text: 'Jump between Glass, Clay and Cyber at any time. Your chats and settings come with you.' },
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
      const conv = e.target.closest('[data-convo]');
      const art = e.target.closest('[data-artifact]');
      const rm = e.target.closest('[data-rm]');
      const pal = e.target.closest('#palList [role=option]');
      if (!e.target.closest('#popover') && !e.target.closest('[data-action$="-menu"], [data-action="notifications"]')) closePopover();
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
        'toggle-sidebar': toggleSidebar,
        'open-nav': openNav,
        'close-nav': closeNav,
        'setup-model': openModel,
        'close-modal': closeModals,
        'settings': openSettings,
        'palette': openPalette,
        'tour': startTour,
        'tour-next': nextTour,
        'tour-end': endTour,
        'open-folder': pickFolder,
        'attach': () => $('#fileInput').click(),
        'mode-menu': () => modeMenu(a),
        'model-menu': () => modelMenu(a),
        'notifications': () => notifMenu(a),
        'mic': toggleMic,
        'share': () => copy(location.href, 'Link copied'),
        'activity': () => { const d = $('#activity'); d.hidden = !d.hidden; if (!d.hidden) renderLog(); },
        'voice': () => { state.voice = !state.voice; a.setAttribute('aria-pressed', state.voice); if (!state.voice && 'speechSynthesis' in window) speechSynthesis.cancel(); toast(state.voice ? 'Replies will be read aloud' : 'Read aloud is off', 'volume'); },
        'auto': () => { state.auto = !state.auto; a.setAttribute('aria-pressed', state.auto); toast(state.auto ? 'Auto-approve on: the agent acts without asking' : 'Auto-approve off: the agent asks first'); log(`Auto-approve ${state.auto ? 'on' : 'off'}`); },
      };
      if (map[act]) { e.preventDefault(); map[act](); }
    });

    $('#composer').addEventListener('submit', (e) => { e.preventDefault(); send(); });
    $('#prompt').addEventListener('input', autosize);
    $('#prompt').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    });
    $$('.suggest').forEach((b) => b.addEventListener('click', () => send(b.textContent)));
    $('#recentSearch').addEventListener('input', renderRecents);
    $('#modelForm').addEventListener('submit', connectModel);
    $('#providers').addEventListener('click', (e) => {
      const b = e.target.closest('[data-prov]'); if (!b) return;
      provSel = PROVIDERS.find((p) => p.id === b.dataset.prov); paintProv(); $('#modelError').textContent = '';
    });
    $('#settingsForm').addEventListener('submit', saveSettings);
    $('#setModelBtn').addEventListener('click', () => { if (state.model) disconnectModel(); else { closeModals(); openModel(); } });
    $('#resetDemo').addEventListener('click', () => {
      state.convos = seedConvos(); state.current = null; save(); closeModals(); newChat(); toast('Chats cleared');
    });
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
  initStudio();
  paintModel();
  renderRecents();
  renderThread();
  log('Session started');
  route();
})();

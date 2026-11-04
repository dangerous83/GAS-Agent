# GAS Agent — White-label Interface Studio

A white-label front end for the GAS Agent platform with **seven complete interfaces** sharing the same features. **Pro** is the main interface and opens by default.

| Skin | Style | Open |
|------|-------|------|
| **Pro** (default) | AI workspace in deep navy: grouped sidebar, breadcrumb bar, a wide composer with the **job model** (role) picker, role quick actions, "Continue working" cards and role tools | `index.html` or `index.html#pro` |
| Glass | Glassmorphism: frosted panels over a drifting aurora | `index.html#glass` |
| Clay | Claymorphism: soft 3D controls, pastel color-coded tools | `index.html#clay` |
| Cyber | Cybersecurity console: HUD panels, live status bar, secure boot | `index.html#cyber` |
| Nebula | AI purple with an interactive neural core: click to pulse, drag to spin, morph between Reason / Create / Analyze / Remember; it listens while you type | `index.html#nebula` |
| Gold | Quiet luxury: warm black, ivory type, Cormorant serif display, champagne gold used only for hairlines, small labels and the primary action | `index.html#gold` |
| Matte | Matte black with signal-red accents: soft depth, red primary controls and labels, slow red light trails in the background, a red light that circles the message box while typing | `index.html#matte` |

Open `index.html` in a browser (no build step) to start in the Pro workspace. The studio launcher, where you compare skins and set your brand name, is at `index.html#studio`.

## Pro workspace and job models

Pick a role from the dropdown in the message box (or from `Ctrl/Cmd + K`). Each role changes three things:

1. **AI instructions**: the model answers as that professional (Philippine context by default for tax, accounting, HR and legal topics)
2. **Quick actions**: the four cards under the message box. Prompt cards fill the message box and select the part to fill in; tool cards open the matching tool
3. **Role tools**: two working calculators that update as you type, with **Ask the role about this**, **Copy** and **Save to Artifacts**

| Role | Tools |
|------|-------|
| Accountant | VAT calculator, depreciation schedule (straight-line or double-declining) |
| Tax Associate | Income tax estimator (TRAIN graduated rates or 8%), payroll withholding (SSS, PhilHealth, Pag-IBIG, tax, net pay) |
| Finance Manager | Loan amortization, NPV / IRR / payback |
| Legal Assistant | Deadline calculator (calendar or business days), contract clause check |
| Marketing Manager | Campaign ROI (ROAS, ROI, CPA, CTR, CPC, CPM), UTM link builder |
| Sales Executive | Pipeline forecast, commission with accelerator |
| HR Manager | Overtime and premium pay, 13th month pay |
| Operations Manager | Reorder point and EOQ, OEE |
| Software Developer | JSON formatter, regex tester |
| Agronomist | Fertilizer bags (14-14-14, urea, potash), seeding rate |
| General assistant | No job model; general quick actions |

Tax, payroll and labor figures use published 2025 rates and are estimates: the tools say so and suggest checking official sources. Roles, prompts and tools are defined in `assets/pro.js` (`ROLES` and `T`); add a role by adding an entry there.

**New chat** opens a clean chat screen with starter ideas (image, PDF/Word document, look up a person or topic, and the role's own tasks). **Overview**, or **Workspace** in the breadcrumb, returns to the top of the workspace home.

Each tool shows the answer as a plain sentence first (for example "Every ₱1 spent on ads brought back ₱3.60"), then the key numbers, with the full table under "See the full breakdown". Numbers can be typed with commas.

Chats remember the role they were started with, and opening one switches back to it. "Continue working" shows your latest chats with thumbnails; ⋯ opens the pin / move / archive / delete menu.

## Deploy to Vercel

This is a static site, so Vercel needs no build settings.

This repository is connected to Vercel through the Vercel GitHub integration (project `gas-agent`). Every push to `main` deploys to production and every other branch gets a preview URL; no GitHub Actions setup is needed.

To connect a fork or a new copy:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdangerous83%2FGAS-Agent)

Or connect it by hand:

1. Go to https://vercel.com/new and choose **Import Git Repository**, then pick `dangerous83/GAS-Agent`.
2. Leave **Framework Preset** as *Other*, and leave Build Command and Output Directory empty.
3. Click **Deploy**.

Every push then deploys automatically: the production branch goes to your main URL and every other branch gets its own preview URL. Direct links to each interface work on the deployed site too, for example `https://<your-project>.vercel.app/#gold`.

`vercel.json` turns on clean URLs and adds basic security headers. It allows the microphone for the voice-input button.

## What works in every skin
- **Settings center** (sidebar → Settings): searchable sections for Account, Billing, Usage, Appearance, Model, Capabilities, Notifications, Privacy, Customize and Code; every change saves instantly in the browser
- **Plans in Philippine pesos (₱)**: Free, Pro and Team with a Monthly / Annual switch (annual = 2 months free), test-mode checkout with GCash, Maya, card or bank transfer, receipts in billing history, cancel any time. Prices are samples; edit `PLANS` in `assets/app.js`. No payment is taken until you connect a provider such as PayMongo or Stripe
- Conversation menu (⋯ on hover, or right-click a chat): Pin to the top, Move to project (existing or new), Archive (with an Archived view to restore), Delete (with confirmation); Archive and Delete can be undone
- Sidebar: New chat, searchable Recents, Code, Projects, Artifacts, Scheduled, Team room, Agents, Open local folder, Guide & tour, Settings
- **Home** button and interface menu in every skin to go back to the studio or switch skins (in Pro: the profile menu at the bottom of the sidebar)
- **Image and video generation (test mode, no API):** 4 image variations with full-size viewer and PNG download; 6-second looping video with play/pause, scrubbing and WebM export. Scenes are painted on canvas from the prompt (city, ocean, mountains, space, forest, abstract) and saved to Artifacts
- Time-based greeting and an optional "Use your own model" dialog (OpenRouter, OpenAI, Anthropic, Gemini, LM Studio, Ollama)
- Composer: + menu (attach files, generate image, create video), open a real local folder, Normal / Plan / Quick modes, voice input (where the browser supports it), read replies aloud, Auto-approve, model picker
- Sample replies with tables and file cards; created files appear in Artifacts
- Command palette (`Ctrl/Cmd + K`), notifications, activity log, share link, guided tour
- White label: change the product name and subtitle in the studio or Settings; it updates every skin
- Responsive down to phone width

## Documents, images and web lookups (every skin)

- **PDF and Word files:** ask for a document ("Write a leave policy as a PDF and Word file"). The AI writes it and a card offers **Download PDF** and **Download Word**. Every reply also has Copy / PDF / Word buttons, and documents are kept in Artifacts. Files are built in the browser: Word (`.docx`) by `assets/docs.js`, PDF with jsPDF (`assets/vendor/jspdf.umd.min.js`, MIT, loaded only when needed). PDFs use the standard PDF fonts, so ₱ is written as "PHP" and non-Latin scripts are not supported in PDF (use Word for those)
- **Images:** "Generate an image of …" or + → Generate an image (free Flux model, with a local fallback)
- **Web lookups for people and topics:** messages like "Who is …?", "look up …" or "search the web for …" call `api/search.js` (Wikipedia and DuckDuckGo, no key needed). The results go to the AI as cited sources and appear as source chips under the reply. Turn on Settings → Capabilities → Web search to look things up for every question. The AI is told to share public, professional information about public figures and not to compile private details (addresses, phone numbers, family) about private individuals

## Live AI (works right after deploying)

On Vercel, chat replies come from a real model through the serverless functions in `api/`:

- `api/chat.js` streams the reply (`POST /api/chat`)
- `api/health.js` tells the app which model is answering (`GET /api/health`)
- `api/search.js` returns web sources for a query (`GET /api/search?q=...`)
- `api/_llm.js` picks the provider from environment variables

With no setup at all it uses a free public model (Pollinations), so the app works as soon as it is deployed. To use your own provider, add **one** of these in Vercel → Project → Settings → Environment Variables, then redeploy:

| Variable | Model used (override with the second variable) |
|---|---|
| `ANTHROPIC_API_KEY` | `claude-sonnet-5-5` (`ANTHROPIC_MODEL`) |
| `OPENAI_API_KEY` | `gpt-4o-mini` (`OPENAI_MODEL`) |
| `OPENROUTER_API_KEY` | `openrouter/auto` (`OPENROUTER_MODEL`) |
| `GEMINI_API_KEY` | `gemini-2.5-flash` (`GEMINI_MODEL`) |
| `LLM_BASE_URL` | any OpenAI-compatible server (`LLM_API_KEY`, `LLM_MODEL`, `LLM_NAME`) |

Set `DISABLE_FREE_MODEL=1` to turn off the free fallback. Keys stay on the server; visitors never see them. Set a spending limit with your provider, because anyone who can open the site can use the model.

What the AI does in the app:

- Streams Markdown replies (headings, lists, tables, links) with a Stop button and Try again on errors
- Writes code in highlighted blocks with **Copy**, **Download** and **Preview** (HTML and SVG run live in a sandboxed frame); longer code is saved to Artifacts
- Reads attached text files (code, CSV, Markdown, JSON …) and knows the file list of an opened folder
- Uses your Settings: response mode, style, reply language, custom instructions and display name
- Images come from the free Flux model (Pollinations); videos animate an AI keyframe. Both fall back to the built-in canvas renderer when offline
- People can still plug in their own key or a local LM Studio / Ollama model from the model menu (“Use your own model”)

Opened as a local file or in a preview without the `api/` functions, the app shows clearly marked sample replies instead.

## Files
- `index.html` — markup for the studio and the shared app shell
- `assets/styles.css` — shared layout plus the Glass, Clay, Cyber, Nebula, Gold and Matte skins
- `assets/pro.css` — the Pro workspace skin
- `assets/app.js` — shared behavior
- `assets/pro.js` — Pro workspace: job models, quick actions, role tools, Continue working, New chat screen
- `assets/docs.js` — Markdown to Word (.docx) and PDF downloads
- `assets/vendor/` — jsPDF (MIT)
- `assets/img/` — artwork used by Pro (Continue working thumbnails and the role card)
- `api/` — Vercel functions for live AI chat
- `assets/logo/` — logo mark (core + six per-skin variants) and wordmark as SVG

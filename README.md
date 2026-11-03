# GAS Agent — White-label Interface Studio

A white-label front end for the GAS Agent platform with **three complete interfaces** sharing the same features:

| Skin | Style | Open |
|------|-------|------|
| Glass | Glassmorphism: frosted panels over a drifting aurora | `index.html#glass` |
| Clay | Claymorphism: soft 3D controls, pastel color-coded tools | `index.html#clay` |
| Cyber | Cybersecurity console: HUD panels, live status bar, secure boot | `index.html#cyber` |

Open `index.html` in a browser (no build step) to see the studio launcher and pick a skin.

## What works in every skin
- Sidebar: New chat, searchable Recents, Code, Projects, Artifacts, Scheduled, Team room, Agents, Open local folder, Guide & tour, Settings
- Time-based greeting, "Connect a model" card and a model setup dialog (OpenRouter, OpenAI, Anthropic, Gemini, LM Studio, Ollama)
- Composer: attach files, open a real local folder, Normal / Plan / Quick modes, voice input (where the browser supports it), read replies aloud, Auto-approve, model picker
- Sample replies with tables and file cards; created files appear in Artifacts
- Command palette (`Ctrl/Cmd + K`), notifications, activity log, share link, guided tour
- White label: change the product name and subtitle in the studio or Settings; it updates every skin
- Responsive down to phone width

Replies are simulated in this front end. Connect `send()` / `makeReply()` in `assets/app.js` to your agent backend to get real model output. API keys are never written to storage.

## Files
- `index.html` — markup for the studio and the shared app shell
- `assets/styles.css` — shared layout plus the Glass, Clay and Cyber skins
- `assets/app.js` — all behavior
- `assets/logo/` — logo mark (core + per-skin variants) and wordmark as SVG

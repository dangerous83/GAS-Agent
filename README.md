# GAS Agent — White-label Interface Studio

A white-label front end for the GAS Agent platform with **six complete interfaces** sharing the same features:

| Skin | Style | Open |
|------|-------|------|
| Glass | Glassmorphism: frosted panels over a drifting aurora | `index.html#glass` |
| Clay | Claymorphism: soft 3D controls, pastel color-coded tools | `index.html#clay` |
| Cyber | Cybersecurity console: HUD panels, live status bar, secure boot | `index.html#cyber` |
| Nebula | AI purple with an interactive neural core: click to pulse, drag to spin, morph between Reason / Create / Analyze / Remember; it listens while you type | `index.html#nebula` |
| Gold | Quiet luxury: warm black, ivory type, Cormorant serif display, champagne gold used only for hairlines, small labels and the primary action | `index.html#gold` |
| Matte | Matte black with signal-red accents: soft depth, red primary controls and labels, slow red light trails in the background, a red light that circles the message box while typing | `index.html#matte` |

Open `index.html` in a browser (no build step) to see the studio launcher and pick a skin.

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
- Sidebar: New chat, searchable Recents, Code, Projects, Artifacts, Scheduled, Team room, Agents, Open local folder, Guide & tour, Settings
- **Home** button and interface menu in every skin to go back to the studio or switch skins
- **Image and video generation (test mode, no API):** 4 image variations with full-size viewer and PNG download; 6-second looping video with play/pause, scrubbing and WebM export. Scenes are painted on canvas from the prompt (city, ocean, mountains, space, forest, abstract) and saved to Artifacts
- Time-based greeting, "Connect a model" card and a model setup dialog (OpenRouter, OpenAI, Anthropic, Gemini, LM Studio, Ollama)
- Composer: + menu (attach files, generate image, create video), open a real local folder, Normal / Plan / Quick modes, voice input (where the browser supports it), read replies aloud, Auto-approve, model picker
- Sample replies with tables and file cards; created files appear in Artifacts
- Command palette (`Ctrl/Cmd + K`), notifications, activity log, share link, guided tour
- White label: change the product name and subtitle in the studio or Settings; it updates every skin
- Responsive down to phone width

Replies and media are simulated in this front end. Connect `send()` / `makeReply()` in `assets/app.js` to your agent backend (and swap the `Gen` canvas renderer for your image/video API) to get real model output. API keys are never written to storage.

## Files
- `index.html` — markup for the studio and the shared app shell
- `assets/styles.css` — shared layout plus the Glass, Clay and Cyber skins
- `assets/app.js` — all behavior
- `assets/logo/` — logo mark (core + six per-skin variants) and wordmark as SVG

# AGENTS.md — Ryza AI Codebase Guide

This file is a guide for AI coding agents working in this repository. Read it before making any changes.

---

## Project overview

`ryza-ai` is an offline AI companion game featuring Ryza (Reisalin Stout) from the *Atelier Ryza* series. The user chats with an LLM-powered Ryza through a browser/PWA/Android/Electron client. There is no official backend — all AI requests are proxied through a local Bun server.

**Current state:** The client is written in plain vanilla JS (IIFE globals, no bundler). The codebase is being **migrated to Svelte 5 + TypeScript**. The existing JS modules are the authoritative reference implementation.

---

## Repository layout

```
src/            Bun server (TypeScript)
  serve.ts      HTTP server entry — static files, /_proxy, /config/providers.json
  libs/
    static.ts   Glob-based static route builder

web/            Static client (served as-is)
  index.html    Single-page shell — all views are hidden <div> panels
  css/app.css   All styles
  vendor/
    spine-webgl.js  Vendored Spine WebGL IIFE bundle (global `spine`)
  js/           Feature modules (IIFE globals, load order matters — see below)
  assets/       ⚠ GITIGNORED — extracted from APK on `bun install`

config/
  providers.example.json  Template config
  providers.json          ⚠ GITIGNORED — local provider keys
  version.json            Single source of truth for version

scripts/
  prepare.ts    postinstall — downloads APK and extracts web/assets/
```

---

## Module map (`web/js/`)

All JS files expose a single `window.*` global. Load order (from `index.html`):

| File | Global | Responsibility |
|---|---|---|
| `util.js` | `Util` | Math helpers: `clamp`, `lerp`, `weighted`, `hashHex`, `swapHashHalves`. No dependencies on other globals. |
| `config.js` | `Config` | `localStorage`-backed settings store. Sections: `llm`, `tts`, `chara`, `profile`, `app`, `memory`. Use `Config.section('llm')` to read. |
| `i18n.js` | `I18n`, `Langs` | UI string table for `zh`/`ja`/`en`. `I18n.tc(key, fallback)` is the translation call everywhere. |
| `api.js` | `Api` | LLM + TTS transport. Builds system prompt (`persona()`), calls `/_proxy`, streams SSE, parses `<state>{...}</state>` tags from LLM replies. Emotion tags drive `Avatar`; state tags drive `Game`. |
| `memory.js` | `Memory` | Two-layer rolling memory. `sessions` (recent windows) fold into `summaries`. Summaries are injected before history in every LLM call. |
| `game.js` | `Game` | RPG state (stamina, gold, EXP, inventory, bag). Reads/writes `ryza.game.v1` in localStorage. Item registry and bag upgrade costs are defined here. |
| `quests.js` | `Quests` | Quest engine. 8-stage main chain + LLM-generated side quests. Advances via `Quests.advance(type, n)`. State lives on `Game.s.quest`. |
| `daily.js` | `Daily` | 7-day daily login calendar. Rewards flow through `Game`. |
| `avatar.js` | `Avatar` | Spine 2D rendering. Single WebGL context for character + stage background. Handles emotion, idle animations, gaze, lip-sync, camera, atlas variant switching (`setAtlasVariant`). |
| `nsfw.js` | `Nsfw` | Switches `Avatar` between the default and `nsfw` atlas variant. The LLM decides via an `undress:on`/`undress:off` tag — player text never forces it. |
| `world.js` | `World` | World map (areas → fields → stages). Loads `world_hierarchy.json`, `npc_placement.json`, `stage_background_map.json`, `scenes.json` from `assets/_index/`. |
| `audio.js` | `Sound` | BGM/ambient/SFX routing. Unlocks on first user gesture. Voice bank and lipsync envelope loader. |
| `alarm.js` | `Alarm` | Alarm clock. Schedules and fires voiced wake-up clips from `assets/audio/alarm/`. |
| `onboarding.js` | `Onboarding` | Title screen, onboarding questions (birthday/gender/free text/choice), prologue, tutorial talk. |
| `fx.js` | `Fx` | Canvas particle effects: title fire, voice-toggle animation, quest completion confetti. Timing from Lottie JSON at `assets/animations/`. |
| `shell.js` | *(side-effect)* | Electron frameless window controls. Only activates when `window.ryzaShell` is present (Electron). |
| `kbd.js` | *(side-effect)* | Android IME viewport fix. Only activates on Android. Pins `#phone` height when the software keyboard opens. |
| `app.js` | `App` | Top-level orchestrator. Boots all modules, wires the talk loop (send → LLM → TTS → lip-sync), RPG event dispatch, and UI panel navigation. |

---

## Server (`src/`)

### `serve.ts`

- Serves the entire `web/` directory as static routes via `createStaticRoutes`.
- Exposes `/_proxy` (`GET`/`POST`) — a thin HTTPS forwarder with auth header passthrough. All client API calls target this endpoint with `?u=<encoded-upstream-url>`. Only HTTPS targets are accepted.
- Exposes `/config/providers.json` for development (seeds LLM/TTS settings; gitignored in production).
- Port/host configurable via `PORT` / `HOST` env vars (default: `localhost:3434`).

### `src/libs/static.ts`

Globs `web/**` and creates a `Record<string, Response>` for Bun's native route table. Handles `index.html` → `/` shortcuts.

---

## Data flows

### Talk loop

```
User input
  → App (collect history + memory)
    → Api.chat() — POST /_proxy?u=<llm-base-url>/chat/completions
      ← streaming SSE (or JSON)
        → parse <state> block → Game.applyDelta()
        → parse emotion/attitude tags → Avatar.setEmotion()
        → typewriter display in #log-text
        → Api.speak() — POST /_proxy?u=<tts-base-url>/… → audio blob
          → App.audio.src = blob URL → play
            → Avatar lipsync (Web Audio AnalyserNode)
```

### Settings persistence

```
In-game Settings panel → Config.set(section, key, value) → localStorage
                       ← Config.section(name) everywhere else
```

### Game state

```
LLM reply <state>{...}</state> → Game.applyDelta(delta)
Quests.advance(type, n)        → Game.applyDelta(delta)
UI button (craft/sell/sleep)   → Game.applyDelta(delta)
                               → localStorage[ryza.game.v1]
```

### Asset loading

```
bun install
  → scripts/prepare.ts
    → fetch GitHub release APK (zeroa234/ryza-ai-revive)
    → unzip → web/assets/
    → write web/assets/VERSION stamp
```

---

## Key conventions

### Global namespace pattern (current vanilla JS)

Every module is an IIFE that assigns one global:

```js
(function (global) {
  'use strict';
  var Foo = { ... };
  global.Foo = Foo;
})(window);
```

When migrating to Svelte/TS, replace each global with a proper ES module export or Svelte store.

### `Config.section(name)` API

Always read settings via `Config.section('llm')`, never from `localStorage` directly. `Config.set(section, patch)` merges and persists.

### LLM response structure

The LLM is instructed to emit a `<state>{json}</state>` block at the end of each reply. `api.js` strips this before display and passes the JSON to `Game.applyDelta`. Emotion is embedded as inline tags like `[emotion:happy]` / `[attitude:agree]`.

### Translation

Use `I18n.tc(key, fallbackString)` everywhere a UI string appears. Keys follow dot-notation (e.g. `'nav.talk'`, `'toast.saved'`). In-character Japanese content is **not** translated.

### Spine rendering notes

- Single WebGL canvas (`#scene-canvas`) renders both the stage background and the foreground character.
- The vendored `spine-webgl.js` exposes the `spine` global (IIFE, not ES module). When migrating, either keep the IIFE or switch to the `@esotericsoftware/spine-webgl` npm package.
- Atlas variant switching (`Avatar.setAtlasVariant('nsfw' | 'default')`) reloads the texture atlas at runtime without recreating the skeleton.
- Camera logic is in `avatar.js` — `Avatar._view` is the shared ortho window. Do not bypass it.

---

## What is and isn't in the repo

| Item | Status |
|---|---|
| `web/js/` — application code | ✅ Committed |
| `web/css/app.css` | ✅ Committed |
| `web/index.html` | ✅ Committed |
| `web/vendor/spine-webgl.js` | ✅ Committed |
| `config/providers.example.json` | ✅ Committed |
| `src/` — Bun server | ✅ Committed |
| `web/assets/` — game assets | ❌ Gitignored — run `bun install` |
| `config/providers.json` | ❌ Gitignored — copy from example |
| `node_modules/` | ❌ Gitignored |

---

## Running locally

```bash
bun install          # installs deps + extracts assets
bun run dev          # starts http://localhost:3434
```

---

## Migration target (Svelte 5 + TypeScript)

The planned migration maps current modules to Svelte stores and components roughly as:

| Current | Target |
|---|---|
| `Config` (localStorage) | Svelte `$state` / `$derived` wrapping localStorage |
| `Game`, `Quests`, `Daily`, `Memory`, `Alarm` | Svelte stores (runes-based) |
| `Avatar` | Svelte component wrapping the Spine canvas |
| `Api` (transport) | Plain TS module (no DOM dependency) |
| `i18n.js` | Replace with a typed i18n library or typed key map |
| `app.js` (top-level orchestrator) | Root Svelte component |
| IIFE globals | ES module exports; no `window.*` globals |

When writing new Svelte code, always check the existing JS module first to understand the exact data shapes, edge cases, and comments explaining non-obvious decisions (many reference original AOT-recovered wire keys or APK source paths).

---

## Do not

- **Do not commit `config/providers.json`** — it contains API keys.
- **Do not commit `web/assets/`** — they are large binary assets extracted from the APK.
- **Do not add unrelated runtime npm dependencies** — the server has no production deps; the client is intentionally dependency-free at runtime.
- **Do not change `config/version.json` manually** — it must stay in sync with `package.json`.
- **Do not call LLM/TTS endpoints directly from the client** — all API calls must go through `/_proxy` to avoid CORS issues and to allow the server to inject headers.

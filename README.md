# ryza-ai

An offline-capable AI companion game featuring **Ryza** (Reisalin Stout) from the _Atelier Ryza_ series. Chat with her, explore the world map, complete quests, and hear her speak — all powered by a user-supplied OpenAI-compatible LLM and TTS endpoint, with no dependency on any official server.

---

## Features

- **AI conversation** — LLM-driven dialogue with Ryza, with structured emotion, attitude, and game-state tags embedded in each response.
- **Spine 2D animation** — Real-time skeletal character rendering (foreground + stage background) via a vendored `spine-webgl` build. Emotion, idle poses, gaze, and lip-sync are driven by the `gesture.json` data baked into the assets.
- **Text-to-speech** — Supports OpenAI-compatible clone/preset voice endpoints and Alibaba Cloud DashScope (Qwen/CosyVoice). A reference audio clip (Ryza's own voice) is used as the cloning source.
- **RPG layer** — Stamina, gold, EXP, inventory, item crafting, battles, and a shop, all stored in `localStorage`.
- **Quest system** — An 8-stage main quest chain reconstructed from the original game, followed by LLM-generated side quests.
- **World map** — Five areas → 38 fields → 120 stages from `world_hierarchy.json`. NPC placement resolves deterministically per `(npc, day)`.
- **Daily login** — 7-day reward calendar (stamina, gold, EXP, items).
- **Alarms** — Ryza wakes you up with voiced clips, per time-of-day and style (normal / whisper).
- **Multilingual UI** — `zh` / `ja` / `en` + `zh-TW`, `hi`, `id`, `pt-BR` voice packs. In-character content always stays in Japanese.
- **Two-layer conversation memory** — Sessions fold into summaries, summaries fold into one, giving very long-term memory without growing the context window unboundedly.
- **PWA / offline** — Designed to run fully offline once the assets are extracted and an endpoint is configured.
- **Multi-platform** — Browser PWA, Android WebView (APK), and Electron desktop shell (frameless window with pin/minimize/close controls).

---

## Architecture

```
ryza-ai/
├── src/                        # Bun server (TypeScript)
│   ├── serve.ts                # Entry point — static file serving + /_proxy + /config/providers.json
│   └── libs/
│       └── static.ts           # Glob-based static route builder for ./web/**
│
├── web/                        # Client (plain HTML/CSS/JS, no bundler)
│   ├── index.html              # Single HTML shell — all UI panels live here as hidden <div>s
│   ├── css/
│   │   └── app.css             # All styles (~36 KB)
│   ├── vendor/
│   │   └── spine-webgl.js      # Vendored Spine WebGL runtime (IIFE build, exposes global `spine`)
│   ├── js/                     # Application modules (plain IIFE scripts, loaded in order)
│   │   ├── util.js             # Shared math helpers (clamp, lerp, weighted pick, Spine hash utils)
│   │   ├── config.js           # Settings store — reads/writes localStorage; default LLM/TTS config
│   │   ├── i18n.js             # UI string table (zh/ja/en/…) + runtime locale switching
│   │   ├── api.js              # LLM + TTS transport; builds system prompt; parses <state> tags
│   │   ├── memory.js           # Two-layer rolling memory (sessions → summaries)
│   │   ├── game.js             # RPG state — stamina, gold, EXP, inventory, items, bags
│   │   ├── quests.js           # Quest engine — main chain + LLM-generated side quests
│   │   ├── daily.js            # Daily login reward calendar
│   │   ├── avatar.js           # Spine rendering — character + stage background, emotion, camera
│   │   ├── nsfw.js             # Atlas variant switch (default ↔ nsfw); LLM decides via `undress:` tag
│   │   ├── world.js            # World map — hierarchy, NPC placement, scene/stage navigation
│   │   ├── audio.js            # BGM / ambient / SFX routing; voice bank + lipsync envelope
│   │   ├── alarm.js            # Alarm clock — schedules voiced wake-up clips
│   │   ├── onboarding.js       # Title screen, onboarding questions, prologue, tutorial talk
│   │   ├── fx.js               # Canvas particle FX — title fire, voice-toggle anim, quest confetti
│   │   ├── shell.js            # Electron frameless window controls (pin / minimize / close)
│   │   ├── kbd.js              # Android IME viewport fix (adjustResize + height pin)
│   │   └── app.js              # Main controller — boots game, wires talk loop, orchestrates all modules
│   └── assets/                 # ⚠ Not committed — extracted from the APK release at install time
│       ├── voice/              # Pre-recorded voice clips (WAV) used as TTS reference audio
│       ├── audio/              # BGM (m4a), ambient, and SFX
│       ├── animations/         # Lottie JSON for UI FX (fire, confetti, voice-toggle)
│       ├── world_map/          # World map artwork + UI pins (SVG)
│       ├── _index/             # JSON data files (world_hierarchy, npc_placement, stage_background_map, scenes)
│       └── …                   # Spine skeleton/atlas/texture files, character icons, UI icons, etc.
│
├── config/
│   ├── providers.example.json  # Template — copy to providers.json and fill in your endpoints/keys
│   ├── providers.json          # ⚠ Not committed — your LLM + TTS provider config
│   └── version.json            # Single source of truth for the version number
│
├── scripts/
│   └── prepare.ts              # postinstall — downloads the matching APK release and extracts web/assets
│
├── package.json
├── tsconfig.json
└── bun.lock
```

---

## Prerequisites

- **[Bun](https://bun.com)** ≥ 1.x
- `unzip` available on `PATH` (used by `scripts/prepare.ts` to extract assets)
- An **OpenAI-compatible LLM endpoint** (local or remote, e.g. Ollama, LM Studio, vLLM)
- _(Optional)_ An **OpenAI-compatible TTS endpoint** or DashScope / Fish Audio credentials for voiced responses

---

## Setup

### 1. Install dependencies and extract assets

```bash
bun install
```

`postinstall` runs `scripts/prepare.ts` automatically. It downloads the APK for the current package version from the GitHub releases page and extracts `web/assets/` from it. Assets are gitignored; the version stamp at `web/assets/VERSION` prevents redundant re-downloads.

### 2. Configure providers

```bash
cp config/providers.example.json config/providers.json
```

Edit `config/providers.json` with your LLM and TTS endpoint details. The file is gitignored and never committed.

### 3. Run the dev server

```bash
bun run dev
# or
bun --watch src/serve.ts
```

The server starts at **http://localhost:3434** by default.  
Set `PORT` and/or `HOST` environment variables to override.

---

## Configuration

All runtime settings (LLM base URL, API key, model, TTS mode, etc.) are also configurable directly in-game via the **Settings** panel, where they are persisted to `localStorage`.

`config/providers.json` is only read by the dev server (`serve.ts`) and serves as a quick-start seed — it is **not** loaded by the client in production APK/desktop builds.

### LLM settings (`config.llm`)

| Field          | Default       | Description                                                   |
| -------------- | ------------- | ------------------------------------------------------------- |
| `baseUrl`      | _(empty)_     | OpenAI-compatible base URL (e.g. `http://localhost:11434/v1`) |
| `model`        | `gpt-4o-mini` | Model ID                                                      |
| `apiKey`       | _(empty)_     | API key (stored in localStorage only)                         |
| `temperature`  | `0.9`         | Sampling temperature                                          |
| `maxTokens`    | `400`         | Max tokens per response                                       |
| `historyTurns` | `12`          | Recent conversation turns to include                          |
| `thinking`     | `auto`        | Extended thinking: `auto` / `on` / `off`                      |

### TTS settings (`config.tts`)

| Field        | Default                                 | Description                                                           |
| ------------ | --------------------------------------- | --------------------------------------------------------------------- |
| `provider`   | `openai`                                | `openai` (clone/preset) or `qwen` (DashScope)                         |
| `mode`       | `clone`                                 | `clone` (voice clone from reference) / `preset` (fixed voice) / `off` |
| `modelClone` | _(placeholder)_                         | Voice-clone model ID                                                  |
| `reference`  | `assets/voice/ryza_wav/prologue_08.wav` | Reference WAV for voice cloning                                       |

### Proxy

All API calls from the client pass through `/_proxy?u=<encoded-target-url>`. The Bun server forwards them, injects the `User-Agent`, and propagates `Authorization` / `api-key` headers. Only HTTPS targets are allowed.

---

## The `web/js` module load order

Scripts are plain IIFE globals loaded in dependency order by `index.html`:

```
spine-webgl.js  →  util  →  config  →  i18n  →  api  →  memory
→  game  →  quests  →  daily  →  avatar  →  nsfw  →  world
→  audio  →  alarm  →  onboarding  →  fx  →  shell  →  kbd  →  app
```

Each module exposes one global object (e.g. `window.Config`, `window.Avatar`, `window.Game`). `app.js` is the top-level orchestrator that wires them together.

---

## Assets

Assets are **not** stored in the repository. They are extracted from the official APK release (see `scripts/prepare.ts`). Key asset types:

| Path                         | Contents                                                             |
| ---------------------------- | -------------------------------------------------------------------- |
| `web/assets/voice/ryza_wav/` | Reference WAV clips used as TTS cloning source                       |
| `web/assets/audio/bgm/`      | Background music (`.m4a`)                                            |
| `web/assets/audio/se/`       | Sound effects (`.m4a`)                                               |
| `web/assets/audio/alarm/`    | Localized voiced alarm clips + `.env.json` lipsync envelopes         |
| `web/assets/animations/`     | Lottie JSON for UI particle effects                                  |
| `web/assets/_index/`         | JSON data: world hierarchy, NPC placement, stage backgrounds, scenes |
| `web/assets/world_map/`      | World map artwork + SVG map UI pins                                  |

---

## Third-party libraries

| Library       | Source                      | Notes                                                                                                                                                                                                                                                     |
| ------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spine-webgl` | `web/vendor/spine-webgl.js` | Vendored IIFE build of the [Spine WebGL runtime](https://esotericsoftware.com/spine-api-reference). The source corresponds to `@esotericsoftware/spine-webgl` on npm but is bundled manually (not in `package.json`) and exposes a global `spine` object. |

---

## Versioning

`config/version.json` is the single source of truth for the version number. `package.json` mirrors it. Build scripts for desktop (Electron) and Android (APK) read this file to keep all platform packages in sync.

---

## Planned migration

The current `web/js` layer is intentionally flat vanilla JS (no bundler, no framework). The next phase is a migration to **Svelte 5 + TypeScript**, using the existing modules as the reference implementation for feature parity.

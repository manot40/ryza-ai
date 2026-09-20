# AGENTS.md — Ryza AI Codebase Guide

This file is a comprehensive guide for AI coding agents working in this repository. Read it thoroughly before making any changes.

---

## Project Overview

`ryza-ai` is an offline-capable AI companion game featuring Ryza (Reisalin Stout) from the _Atelier Ryza_ series. The user chats with an LLM-powered Ryza through a responsive web client (browser / PWA / Android WebView / Electron desktop). All AI calls pass through a local proxy endpoint to avoid CORS issues and protect credentials.

**Current State:** The application is fully implemented in **Svelte 5 (Runes) + TypeScript + SvelteKit 2 + Tailwind CSS v4**. The legacy vanilla JS code under `web/js/` is retained as the authoritative reference implementation for data structures, formulas, and game-logic parity.

---

## Repository Layout

```
src/
├── routes/
│   ├── +layout.svelte          # Root orchestrator: viewStore, TopBar, SideMenu, ToastHost, Avatar, sheets
│   ├── +page.svelte            # Main page: TalkView + modal/sheet overlay container
│   ├── _proxy/+server.ts       # Server-side HTTPS proxy forwarder with auth header passthrough
│   └── config/providers.json/  # Endpoint serving local providers configuration
│
├── components/
│   ├── chrome/                 # TopBar, SideMenu, ToastHost, ElectronControls
│   ├── views/                  # TalkView, WorldView, QuestView, DailyView, AlarmView,
│   │                           # CharaView, SkinView, MemoryView, SettingsView, WelcomeView
│   ├── sheets/                 # ModeSheet, InventorySheet, StatusSheet, NpcSheet
│   ├── overlays/               # QuestClearOverlay, AlarmOverlay, AppModal
│   └── ui/                     # bits-ui / shadcn-svelte styled primitives (Button, Card, Sheet, etc.)
│
├── lib/
│   ├── avatar/                 # Spine 2D avatar integration
│   │   ├── Avatar.svelte       # WebGL canvas wrapper with gaze, pointer, and ripple listeners
│   │   ├── avatar-service.svelte.ts # Global avatar singleton store
│   │   └── engine/             # AvatarEngine, camera, gaze, motion, lipsync, effects, hit detection
│   ├── stores/                 # Svelte 5 runes-based state stores ($state / $derived / methods)
│   │   ├── config.svelte.ts    # localStorage settings: llm, tts, voice, chara, profile, app, memory, state
│   │   ├── game.svelte.ts      # RPG mechanics: stamina, gold, exp, inventory items, apple slots, sailing
│   │   ├── quests.svelte.ts    # Quest chain (1-8) + side quests, progressEvent, clear, takeNext, promptBlock
│   │   ├── world.svelte.ts     # World hierarchy (5 areas, 38 fields, 120 stages), NPC guest system, stage map
│   │   ├── alarm.svelte.ts     # Alarms, voiced wake-up clips, todForHour, loadEnv
│   │   ├── daily.svelte.ts     # 7-day login calendar bonuses
│   │   ├── memory.svelte.ts    # Two-layer rolling memory (sessions → summaries)
│   │   ├── session.svelte.ts   # Chat turn history, diary, save slot persistence
│   │   ├── view.svelte.ts      # View navigation router store
│   │   ├── overlay.svelte.ts   # Sheet and modal overlay visibility store
│   │   ├── toast.svelte.ts     # Reactive toast notifications with highest z-index
│   │   └── nsfw.svelte.ts      # Spine atlas variant manager (nsfw vs default)
│   ├── api/                    # LLM + TTS transport, SSE streaming parser, system prompt builder
│   ├── audio/                  # SoundManager (BGM/ambient/SFX), VoiceBankService (alarm/quest voice lines)
│   ├── i18n/                   # Wuchale runtime loaders, game-content localization tables, Langs
│   ├── fx/                     # Confetti particle generator, voice-toggle animation
│   └── talk-loop.svelte.ts     # Conversation coordinator: user send → LLM SSE → state delta → TTS → lipsync
│
web/                            # Static assets and legacy reference implementation
├── assets/                     # ⚠ GITIGNORED — unpacked from APK release on bun install
│   ├── spine/                  # Spine skeletons (.skel), texture atlases (.atlas), gesture definitions (.json)
│   ├── audio/                  # BGM (.m4a), ambient loops, SFX, localized alarm voices (.m4a + .env.json)
│   ├── voice/                  # TTS cloning reference WAV clips
│   └── _index/                 # Game indices: world hierarchy, npc placement, stage background map, scenes
├── vendor/                     # spine-webgl.js IIFE runtime
└── js/                         # Legacy vanilla JS modules (authoritative reference for logic and schemas)

config/
├── providers.example.json      # Template configuration for API endpoints
├── providers.json              # ⚠ GITIGNORED — local API keys and endpoints
└── version.json                # Single source of truth for version numbering

scripts/
└── prepare.ts                  # Postinstall script: downloads APK release and extracts web/assets/
```

---

## Key Conventions & Rules

### Code & Typing Standards

- **Strictly No `any`** — Every variable, parameter, and return value must have a definitive type. If a value is non-deterministic or externally shaped, use `unknown` with runtime type narrowing.
- **Svelte 5 Runes** — Use modern Svelte 5 syntax: `$state()`, `$derived()`, `$derived.by()`, `$effect()`, `$props()`, and `$bindable()`. Do not use legacy Svelte 3/4 reactive syntax (`export let`, `$:`) in new code.
- **Use `es-toolkit`** — For array, object, and utility operations commonly found in Lodash, prefer `es-toolkit`.
- **Always use `bun` or `bunx`** — Do not invoke `npm`, `pnpm`, or `yarn`.

### Spine Rendering & Canvas Interactivity

- Single WebGL canvas renders both the 2D stage background plate and the foreground character.
- **Hit Detection**: Multi-zone bounding boxes (`BB_head`, `BB_breast`, `BB_weast`, `BB_arm_L`, `BB_arm_R`, `BB_body`) driven by Spine `BoundingBoxAttachment` polygons.
  - Head taps are extended along the bounding polygon normal to cover hair ribbons and hats, with bone-relative fallback using `headBone`.
- **UI Overlay Pass-through**: UI containers spanning over the avatar canvas must have `pointer-events-none` on parent containers, applying `pointer-events-auto` strictly to interactive buttons/cards so taps in empty spaces reach the canvas.
- Atlas variant switching (`Avatar.setAtlasVariant('nsfw' | 'default')`) swaps textures at runtime without destroying the skeleton.

### Data Flows & Game Systems

- **Talk Loop**:
  `User input` → `talkLoop.say(text)` → `Api.chat()` (`POST /_proxy?u=...`) → Streaming SSE → Typewriter display → Extract `<state>` delta block → `game.applyDelta()` / `quests.onQuestDelta()` → Extract emotion/attitude tags → `avatarService.setEmotion()` → `Api.speak()` → Web Audio analyser → Spine lip-sync.
- **Quest Completion**:
  When a quest completes (`step >= need` or LLM clear):
  `quests.clear()` triggers `sound.se('quest_clear')`, bursts confetti, and opens `QuestClearOverlay`. Closing the overlay calls `quests.takeNext()` and triggers `talkLoop.playWellDone()` to play Ryza's voiced "おつかれさま！" clip matching the time of day and style.
- **World Map & Guests**:
  World map has 5 areas. Island departure is locked until Quest #8 (ship construction) is completed (`game.sailed`). Guests resolve deterministically based on `(npc, day)` from `npc_placement.json` and appear on area tabs, field headers, and stage cards.

### Language & Localization

- Language settings are decoupled in Settings:
  - **UI Language**: Controls UI text (`en`, `ja`, `zh`, `id`) via Wuchale.
  - **Recorded Voice Language**: Sets the locale for alarm and quest completion audio clips (`ja`, `en`, `zh-tw`, `id`, `hi`, `pt-br`).
  - **Ryza Replies**: Sets the LLM character response language (`auto`, `ja`, `en`, `zh`, `id`).
  - **Speech Language**: Sets the TTS generation language.
- In-character Japanese lore and prompt instructions remain authentic.

---

## What is and isn't in the Repo

| Item                            | Status        | Notes                                                                                      |
| ------------------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| `src/`                          | ✅ Committed  | Full SvelteKit 2 + Svelte 5 application                                                    |
| `web/js/`                       | ✅ Committed  | Authoritative reference implementation                                                     |
| `web/vendor/spine-webgl.js`     | ✅ Committed  | Vendored Spine WebGL IIFE runtime                                                          |
| `config/providers.example.json` | ✅ Committed  | Configuration template                                                                     |
| `web/assets/`                   | ❌ Gitignored | Extracted from APK release via `bun install`                                               |
| `config/providers.json`         | ❌ Gitignored | Contains local private API keys                                                            |
| `config/version.json`           | ✅ Committed  | Single source of truth for versioning (do not edit manually without updating package.json) |

---

## Verification & Toolchain Commands

Before completing any task, run the following verification pipeline:

```bash
bun run check              # SvelteKit sync + svelte-check diagnostics (must have 0 errors)
bun run test:unit -- --run # Run all Vitest unit test suites
bun run fmt:check          # Check code formatting with oxfmt (or `bun run fmt` to format)
bun run build              # Ensure production build succeeds cleanly
```

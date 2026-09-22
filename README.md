# ryza-ai

An offline-capable AI companion game featuring **Ryza** (Reisalin Stout) from the _Atelier Ryza_ series. Chat with her, explore the world map, complete quests, and hear her speak — all powered by a user-supplied OpenAI-compatible LLM and TTS endpoint, with no dependency on any official server.

Built with **Svelte 5 (Runes) + TypeScript + SvelteKit 2 + Vite + Tailwind CSS v4**, backed by a local Bun/Vite proxy server.

---

## Features

- **Spine 2D Interactive Avatar** — Real-time skeletal character rendering (foreground + stage background) via a vendored Spine WebGL runtime. Supports multiple skins (sitting / standing / dual posture), atlas variant swapping (NSFW/default), gaze pointer tracking, lip-sync audio envelope decoding, and multi-zone interactive hitboxes (head, breast, waist, arms, body) with expressive tap reactions and ripples.
- **AI Conversation Loop** — Streaming SSE dialogue driven by user-provided OpenAI-compatible LLM endpoints. Extracts in-response `<state>` tags for RPG game state changes and emotion/attitude tags (`[emotion:happy]`, `[attitude:agree]`) for dynamic character expressions.
- **Character Voice & TTS** — Supports OpenAI-compatible voice cloning from Ryza reference audio, preset voice models, and Alibaba Cloud DashScope (Qwen/CosyVoice). Features pre-recorded Japanese voice lines for wake-up alarms and quest completion congratulations.
- **Comprehensive RPG Systems**:
  - Stamina recovery and depletion (fainting mechanics with safe-return home).
  - Currency (Gold), EXP, character level, inventory bag with capacity upgrades.
  - Materials gathering, alchemy crafting, battles, and shop selling.
- **Quest Chain & Side Quests**:
  - 8-stage reconstructed main quest chain (Kurken Island escape arc & shipbuilding).
  - Infinite procedural side quests generated dynamically via LLM.
  - Quest clear celebration with confetti FX, sound effects, and voiced congratulatory lines.
- **World Map & Guest NPC System**:
  - Hierarchical map: 5 Areas → 38 Fields → 120 Stages.
  - Stage background resolution map with auto-fallback.
  - Area unlocking tied to quest progression (e.g. ship construction).
  - Deterministic NPC guest placement based on in-game day, showing portraits on area tabs, field headers, and stage cards with character info sheets.
- **Two-Layer Rolling Memory** — Recent conversation turns roll into summaries, and summaries consolidate over time, preserving long-term context without exceeding model token windows.
- **Independent Language Settings**:
  - UI Language (`en`, `ja`, `zh`, `id`).
  - Recorded Voice Language.
  - Ryza Chat/Response Language.
  - TTS Generated Speech Language.
- **Multi-Platform Ready** — Browser PWA, Android WebView with IME viewport handling, and Electron frameless window desktop shell.

---

## Architecture & Project Structure

```
ryza-ai/
├── src/                                # SvelteKit 2 application source (TypeScript + Svelte 5)
│   ├── routes/
│   │   ├── +layout.svelte              # Root shell: orchestrates views, chrome, sheets, avatar, & lifecycle
│   │   ├── +page.svelte                # Root view container: TalkView + bottom sheet view host
│   │   ├── _proxy/+server.ts           # Forwarding proxy for LLM/TTS endpoints (CORS & header injection)
│   │   └── config/providers.json/      # Dev-time provider configuration endpoint
│   │
│   ├── components/                     # Svelte 5 UI components
│   │   ├── chrome/                     # TopBar, SideMenu, ToastHost, ElectronControls
│   │   ├── views/                      # TalkView, WorldView, QuestView, DailyView, AlarmView,
│   │   │                               # CharaView, SkinView, MemoryView, SettingsView, WelcomeView
│   │   ├── sheets/                     # ModeSheet, InventorySheet, StatusSheet, NpcSheet
│   │   ├── overlays/                   # QuestClearOverlay, AlarmOverlay, AppModal
│   │   └── ui/                         # shadcn-svelte / bits-ui primitives (Button, Card, Sheet, etc.)
│   │
│   ├── lib/
│   │   ├── avatar/                     # Spine avatar rendering & runtime
│   │   │   ├── Avatar.svelte           # Svelte component binding the Spine WebGL canvas
│   │   │   ├── avatar-service.svelte.ts# Global avatar singleton store
│   │   │   └── engine/                 # AvatarEngine, camera, gaze, motion, lipsync, effects, hit detection
│   │   ├── stores/                     # Svelte 5 runes-based state stores
│   │   │   ├── config.svelte.ts        # Persistent localStorage configuration store
│   │   │   ├── game.svelte.ts          # RPG state: stamina, gold, exp, items, flags, sailing
│   │   │   ├── quests.svelte.ts        # Quest engine: 8-stage main chain + side quests
│   │   │   ├── world.svelte.ts         # World map, area locks, NPC guest presence
│   │   │   ├── alarm.svelte.ts         # Alarms & voiced wake-up clips
│   │   │   ├── daily.svelte.ts         # 7-day login bonus calendar
│   │   │   ├── memory.svelte.ts        # Two-layer rolling conversation memory
│   │   │   ├── session.svelte.ts       # Chat turn history, diary, save slot persistence
│   │   │   ├── view.svelte.ts          # Active navigation view routing
│   │   │   ├── overlay.svelte.ts       # Bottom sheets and modal overlay state
│   │   │   ├── toast.svelte.ts         # Max z-index reactive toast notifications
│   │   │   └── nsfw.svelte.ts          # Spine atlas variant manager
│   │   ├── api/                        # LLM & TTS client transport, SSE parsing, prompt building
│   │   ├── audio/                      # SoundManager (BGM/ambient/SFX), VoiceBankService
│   │   ├── i18n/                       # Translation loaders (Wuchale), game text tables, Langs
│   │   ├── fx/                         # Particle effects: confetti burst, voice toggle animation
│   │   └── talk-loop.svelte.ts         # Conversation coordinator (send → LLM → TTS → lip-sync)
│   │
│   └── web/                            # Static assets and reference baseline
│       ├── assets/                     # ⚠ Extracted from APK release via postinstall (gitignored)
│       │   ├── spine/                  # Spine skeletons (.skel), texture atlases, gesture definitions
│       │   ├── audio/                  # BGM, ambient tracks, SFX, localized alarm voices (.m4a, .env.json)
│       │   ├── voice/                  # TTS reference WAV samples
│       │   └── _index/                 # Data JSONs: hierarchy, placement, backgrounds, scenes
│       ├── vendor/                     # spine-webgl.js runtime bundle
│       └── js/                         # Original vanilla JS implementation (authoritative reference)
│
├── config/
│   ├── providers.example.json          # Template for LLM / TTS provider endpoints and keys
│   ├── providers.json                  # ⚠ Local provider credentials (gitignored)
│   └── version.json                    # Single source of truth for version numbering
│
├── scripts/
│   └── prepare.ts                      # Downloads APK release and unpacks assets into web/assets/
│
├── package.json
└── tsconfig.json
```

---

## Prerequisites

- **[Bun](https://bun.com)** ≥ 1.1.x
- `unzip` available on system `PATH` (used by `scripts/prepare.ts` for asset extraction)
- An **OpenAI-compatible LLM endpoint** (e.g. Ollama, LM Studio, vLLM, DeepSeek, OpenAI)
- _(Optional)_ An **OpenAI-compatible TTS endpoint** or DashScope / CosyVoice credentials for voice output

---

## Setup & Running

### 1. Install Dependencies & Extract Assets

```bash
bun install
```

`postinstall` runs `scripts/prepare.ts` automatically, downloading the APK for the current version and unpacking `web/assets/`. The version stamp at `web/assets/VERSION` avoids repeated downloads.

### 2. Configure Providers

```bash
cp config/providers.example.json config/providers.json
```

Edit `config/providers.json` with your LLM / TTS endpoint URLs and API keys. This file is gitignored. Runtime settings can also be modified directly in the in-game **Settings** panel.

### 3. Start Development Server

```bash
bun run dev
```

Opens the SvelteKit development server at **http://localhost:5173** (or the port specified by Vite/Bun).

To run the legacy standalone proxy server:

```bash
bun run dev:old
```

---

## Development Scripts

| Command                      | Action                                                  |
| ---------------------------- | ------------------------------------------------------- |
| `bun run dev`                | Starts the Vite / SvelteKit development server          |
| `bun run build`              | Builds the production client and server bundles         |
| `bun run check`              | Runs SvelteKit sync and `svelte-check` type diagnostics |
| `bun run test:unit`          | Runs Vitest unit test suites                            |
| `bun run test:unit -- --run` | Runs all unit tests once and exits                      |
| `bun run fmt`                | Formats all files using `oxfmt`                         |
| `bun run fmt:check`          | Verifies code formatting without writing changes        |

---

## Configuration Reference

Settings are stored in `localStorage` under modular sections:

- **`config.llm`** — `baseUrl`, `apiKey`, `model`, `temperature`, `maxTokens`, `historyTurns`, `thinking` (reasoning model toggle).
- **`config.tts`** — `provider` (`openai` / `qwen`), `mode` (`clone` / `preset` / `off`), `baseUrl`, `apiKey`, `model`, `voice`, `style`, `promptText`.
- **`config.voice`** — `lang` (recorded voice language pack: `ja`, `en`, `zh-tw`, `id`, `hi`, `pt-br`).
- **`config.app`** — `lang` (UI language), `volume`, `voice` (audio toggle), `vibration`, `speechBubble`, `rimLight`, `timePassage`, `textSpeed`.
- **`config.state`** — `mode` (`chat`, `story`, `asmr`, `immersive`), `style` (`normal`, `whisper`, `text`), `stage`, `tod` (`mor`, `aft`, `eve`, `ngt`), `day`.

All client API calls pass through `/_proxy?u=<encoded-url>` with header passthrough, ensuring no client-side CORS issues.

---

## License

Private repository. All Atelier Ryza assets and character rights belong to Koei Tecmo Games / Gust.

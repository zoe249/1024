# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A casual puzzle game built with **Cocos Creator 3.8.8**, combining Tetris-style falling pieces with 2048-style number merging. The game targets **WeChat Mini Games** (primary) and web.

## Build & run

There are no CLI build commands — everything goes through the Cocos Creator 3.8.8 IDE:

1. Open the project root in Cocos Creator 3.8.8
2. Open `assets/scence/game.scene` as the main scene
3. Use the IDE's preview button to run in browser
4. Use **Project → Build** to build for wechatgame (output in `build/wechatgame/`)

No npm scripts, no test suite.

## Engine configuration

The project is 2D-only with these Cocos engine modules enabled (defined in `settings/v2/packages/engine.json`): `2d`, `base`, `ui`, `graphics`, `tween`, `audio`, `affine-transform`, `intersection-2d`, `custom-pipeline`, `gfx-webgl`, `gfx-webgl2`. All 3D, physics, spine, and particle modules are disabled.

## Architecture

All game logic lives in `assets/script/`. The architecture enforces strict separation between logic and rendering:

### Core scripts

- **`PlayController.ts`** — The game brain. Owns all game state: the 2D board array (`BoardCell[][]`), current falling piece, column selection, fast-drop, merge detection (BFS flood fill for same-value connected components), cascading chain resolution (landing merge → gravity → full-board merge loop), game-over detection, score tracking, and all three skill executions (bomb/hammer/swap). Delegates rendering to `PlayUIController` via a plain `PlayUIState` data object — never touches UI nodes directly.

- **`PlayUIController.ts`** — Renders the board and chrome. Draws the glass-style board frame, column separators (dashed lines), score counter (with animated number rolling), skill buttons with active-state feedback, and the pause overlay wrapper. Handles WeChat capsule-button safe-area adaptation. Receives callbacks from PlayController (`onPauseTap`, `onBombSkillTap`, etc.) and calls them on button taps — never mutates game state directly.

- **`PieceController.ts`** — A single piece/block on the board. Draws its own rounded-rect body via `Graphics`, displays its number value, picks a background color from a fixed palette keyed by number (2→pink, 4→purple, ..., 1024→gold). Used as the Prefab for spawning pieces and as the runtime component on every board piece node.

- **`PauseOverlayController.ts`** — The pause menu. Manages the sliding side panel with BGM and SFX volume sliders, persists volume to `sys.localStorage`, and applies settings to `AudioSource` components on the play node.

- **`StartPageController.ts`** — The start/home screen. Displays a "1024 数字花园" title card, floating tile animations, start/rank buttons, a fake friend leaderboard modal, and toast notifications. Calls `onStartTap` to transition into gameplay.

### Data flow

```
PlayController (state owner)
  │
  ├─ buildUiState() → PlayUIState → PlayUIController.renderState()
  │                                 → PauseOverlayController.renderState()
  │
  ├─ spawnPiece() → instantiate piece.prefab → PieceController.setValue()
  │
  └─ StartPageController → onStartTap → startSessionFromStartPage() → spawnPiece()
```

### Board coordinate system

- `row` grows bottom to top (0 = bottom row)
- `column` grows left to right (0 = leftmost)
- Cell origin is computed dynamically from `BoardFill` node dimensions, not hardcoded offsets

### Skills

1. **Bomb** — Player taps a cell; all pieces in the surrounding 3×3 area are destroyed, then gravity + merge settle.
2. **Hammer** — Player taps a single piece; it's destroyed with a hammer-strike animation, then gravity + merge settle.
3. **Swap** — Player drags a piece to an adjacent cell (4-directional, 1-step). If the swap creates a merge group, the merge+gravity chain runs; otherwise the pieces animate back.

### Merge & gravity system

1. On landing: BFS collects the connected component of same-valued pieces including the landed piece. If ≥2 pieces, the lowest-in-column piece becomes the anchor, others fly to it and merge (value doubles per consumed piece).
2. Affected columns undergo gravity (pieces fall to fill gaps).
3. Full-board scan finds all merge groups (BFS on the entire board). Groups are processed in bottom-to-top order. All animations in a batch run in parallel.
4. Repeat step 3 until no merges remain.
5. A new piece spawns only after all settling completes.

## Key conventions

- **Comments in Chinese** — The project convention is to add/update comments after every code change, in Chinese.
- **Scene directory spelling** — `assets/scence/` (not "scene"). This is intentional and referenced throughout.
- **Code-first board rendering** — The board's visual style (glass frame, column separators, tints) is drawn entirely in `PlayUIController.ensureBoardDecorations()` using `Graphics`, not via scene-placed sprites.
- **TypeScript strict mode is off** (`tsconfig.json` sets `strict: false`).
- **No tests** — The project has no automated test infrastructure.

## Important files

| Path | Purpose |
|---|---|
| `assets/scence/game.scene` | Main (and only) game scene |
| `assets/prefab/piece.prefab` | Piece prefab — instantiated to spawn falling pieces |
| `assets/script/PlayController.ts` | Core game logic (~2160 lines) |
| `assets/script/PlayUIController.ts` | UI rendering (~910 lines) |
| `assets/script/PieceController.ts` | Piece display (~200 lines) |
| `assets/script/PauseOverlayController.ts` | Pause menu with audio controls (~530 lines) |
| `assets/script/StartPageController.ts` | Start/home screen (~660 lines) |
| `settings/v2/packages/engine.json` | Engine module configuration |
| `build/wechatgame/` | WeChat Mini Game build output |

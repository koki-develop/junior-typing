# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **Bun** (pinned in `mise.toml`). Use `bun` / `bunx`, not `npm`/`pnpm`.

- `bun run dev` — start Vite dev server
- `bun run build` — type-check (`tsc -b`) then build
- `bun run test` — run Vitest once (`vitest run`)
- `bunx vitest run src/lib/romaji.test.ts` — run a single test file
- `bunx vitest run -t "拗音"` — run tests matching a name
- `bun run lint` — oxlint
- `bun run fmt` / `bun run fmt:check` — oxfmt (formatter)
- `mise run bootstrap` — first-time setup (`bun install` + `lefthook install`)

Pre-commit hook (lefthook) runs `gitleaks`, `oxfmt --fix`, and `oxlint --fix` on staged files and re-stages fixes.

## Architecture

Single-page React 19 + Vite + Tailwind v4 typing game for Japanese input. React Compiler is enabled via `@rolldown/plugin-babel` in `vite.config.ts` — do not add `useMemo`/`useCallback` for optimization purposes.

### Layer split

- `src/data/questions.ts` — the question list. Each `Question` has `text` (display) and `kana` (hiragana used by the input engine).
- `src/lib/romaji.ts` — pure kana→romaji input engine. No React. Fully unit-tested in `romaji.test.ts`.
- `src/lib/useTypingGame.ts` — glues the engine to React via `useReducer` + a single `window` keydown listener. Returns a **discriminated union** `TypingGameState` (`{done: true}` vs `{done: false, ...}`) so consumers get type-level guarantees about which fields exist.
- `src/components/*` + `src/App.tsx` — presentation only. `App.tsx` branches on `game.done`.

### Romaji engine model (`src/lib/romaji.ts`)

The engine splits kana into **moras** (拗音 like `きゃ` counts as one), where each mora carries **multiple valid romaji spellings** (`し` → `si`/`shi`/`ci`, `じゃ` → `zya`/`ja`/`jya`, etc.). A `TypingState` holds `patterns`, the current `unitIndex`, a per-mora `buffer` of accepted keys, and the accumulated `typed` string. `typeKey` advances by:

1. Appending the key to `buffer` and keeping candidates that still start with it.
2. Committing the mora when `buffer` exactly matches a candidate **and no longer candidate is still viable** — this is why `ん` typed as `n` doesn't commit immediately (waits for the next key to disambiguate `n`/`nn`/`na`…).
3. Falling back: if the current `buffer` already fully matches a candidate, commit that mora first, then retry the key against the next mora (handles `ん` → `nk` = commit `n`, start `k`).

Context-dependent moras are resolved in `buildPatterns` by walking units **right to left**:

- **`ん`** — needs `nn`/`xn` when followed by a vowel, `n`/`y`, or when it is the final mora (`requiresDoubleN`). Otherwise `n` is also allowed.
- **`っ`** — candidates are the doubled leading consonants of every next-mora candidate (so `った` accepts `tta`, `っち` accepts both `tti` and `cchi`), plus `ltu`/`xtu`/`ltsu` fallbacks.

`romajiDisplay` returns `{typed, remaining}` where `remaining` reflects the currently chosen spelling branch (e.g. once `s` is typed for `し`, `remaining` stays on the `si`/`shi` branch that starts with `s`).

Adding a new kana: add its candidates to `MORA_TABLE`. `buildPatterns` throws `未対応のかな文字です` on unknown kana — surface that as a real question-data bug, not a runtime edge case to swallow.

### Input handling

`useTypingGame` attaches one `window` keydown listener that:

- Ignores modifier combos (`meta`/`ctrl`/`alt`) so browser shortcuts pass through.
- Ignores non-character keys (`event.key.length !== 1`).
- Lowercases the key before dispatch so Shift/CapsLock still register as the intended letter.

### Styling

Tailwind v4 with tokens defined in `src/index.css` via `@theme` (`bg-canvas`, `text-ink`, `font-round`, `font-mono`, etc.). Fonts are self-hosted through `@fontsource/*` — do not add Google Fonts `<link>` tags.

## Repo conventions

- Comments in source are Japanese and explain the **why** (invariants, context-dependent branches). Match that style; don't add English narration of what code does.
- Local imports use explicit `.ts`/`.tsx` extensions (required by the TS config). Keep them when adding new imports.

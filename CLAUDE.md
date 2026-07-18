# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **Bun** (pinned in `mise.toml`). Use `bun` / `bunx`, not `npm`/`pnpm`.

- `bun run dev` — start Vite dev server
- `bun run build` — type-check (`tsc -b`) then build
- `bun run test` — run Vitest once (`vitest run`)
- `bunx vitest run src/domain/romaji/typing.test.ts` — run a single test file
- `bunx vitest run -t "拗音"` — run tests matching a name
- `bun run lint` — oxlint
- `bun run fmt` / `bun run fmt:check` — oxfmt (formatter)
- `mise run bootstrap` — first-time setup (`bun install` + `lefthook install`)

Pre-commit hook (lefthook) runs `gitleaks`, `oxfmt --fix`, and `oxlint --fix` on staged files and re-stages fixes.

## Architecture

Single-page React 19 + Vite + Tailwind v4 typing game for Japanese input. React Compiler is enabled via `@rolldown/plugin-babel` in `vite.config.ts` — do not add `useMemo`/`useCallback` for optimization purposes.

### Layer split

Dependencies flow one way: `domain` ← `services` ← `features` ← `app`. `src/domain/*` has zero React or cuelume imports and is where all the unit-tested logic lives; `services` and `features` adapt it to the outside world.

- `src/domain/romaji/` — kana→romaji input engine.
  - `moraTable.ts` — `MORA_TABLE` (per-mora candidate spellings) and `SOKUON_FALLBACKS`.
  - `patterns.ts` — `buildPatterns` splits kana into moras and resolves context-dependent candidates.
  - `typing.ts` — `TypingState`, `createTypingState`, `typeKey`, `isFinished`, `romajiDisplay`.
- `src/domain/game/` — pure game state machine; no timers or sound calls of its own.
  - `machine.ts` — `GameState` (`idle`/`countdown`/`playing`/`done`), `GameEvent`, `transition`.
  - `effects.ts` — `GameEffect`/`GameSound`; effects are returned as data, not executed.
  - `view.ts` — `selectView` projects `GameState` into `GameView`, the only thing React reads.
- `src/domain/questions/` — `Question` type and the question list; `questions.test.ts` asserts the list is non-empty and that every question's `kana` produces at least one mora via `buildPatterns`, so bad question data (including an accidentally empty `kana`, which would otherwise slip through as a no-op empty pattern list) fails CI instead of leaving the game stuck at runtime.
- `src/features/typing/` — React glue.
  - `useTypingGame.ts` — thin adapter: holds `GameState` in `useState` (the render's source of truth; `view` is derived from it via `selectView` on every render) and mirrors it into `stateRef` for synchronous reads from `send`/timers. Calls `transition` and executes the returned effects (`playSound` calls `services/sound.ts` directly; `schedule` sets a timer that re-sends the event later — via a `sendRef` kept fresh every render, so a stale render's `send` closure never fires against outdated `questions` — tracked in a `Set` and cleared on unmount).
  - `useKeyboard.ts` — normalizes `keydown` into `GameEvent`s: ignores modifier combos (`meta`/`ctrl`/`alt`), ignores non-single-character keys, `preventDefault`s Space, lowercases the key so Shift/CapsLock still register as intended.
  - `components/` — presentation only. `TypingScreen` is the shell (progress bar → center → keyboard hint) and also hosts an always-mounted sr-only `aria-live` region announcing the countdown (a live region that only mounts once `countdown` starts would miss the first value, since `aria-live` doesn't announce content already present at mount). Its center slot swaps between `IdleMessage`, `CountdownMessage`, and `QuestionDisplay`. All three share `PhaseLayout`'s 3-row skeleton (furigana / headline / romaji); the headline row's height is a `min-height`, not a fixed height, so a wrapped question grows the row instead of overlapping the romaji row below, while idle/countdown/playing still stay visually aligned. `RomajiText` holds no typography of its own — font/size/weight/letter-spacing are inherited from `PhaseLayout`'s romaji row.
- `src/services/sound.ts` — adapter over cuelume's `play()`. `SOUND_NAMES` is typed `satisfies Record<GameSound, SoundName>`, so adding a `GameSound` without mapping it to a cuelume `SoundName` is a compile error.
- `src/app/` — composition root: `main.tsx` mounts the app and imports fonts/`index.css`; `App.tsx` calls `useTypingGame` and branches on `view.phase` (`"done"` → `CompletionScreen`, otherwise `TypingScreen`).

### Game state machine (`src/domain/game/`)

`transition(state, event, questions)` is a pure function returning `{ state, effects }`; it never fires timers or sounds itself. This means the _conditions_ under which an effect fires (e.g. `playSound` on a wrong key, `schedule` after clearing a question) are covered by ordinary state-machine unit tests, not just by exercising the React tree. `transition` assumes `questions` is non-empty and every `kana` yields at least one mora (guaranteed by `questions.test.ts`) — it has no runtime guard for that contract, on purpose, since bad question data is meant to fail CI rather than be defended against at runtime.

Timers are represented as `schedule` effects that re-enter `transition` as a `GameEvent` (`tick`, `advance`) after a delay. Because the delayed event goes back through `transition`'s phase guards, a stale timer firing after the phase already moved on (e.g. an old `advance` arriving while already `idle`) is a no-op instead of a bug — no manual per-transition timer cancellation needed.

### Romaji engine model (`src/domain/romaji/`)

The engine splits kana into **moras** (拗音 like `きゃ` counts as one), where each mora carries **multiple valid romaji spellings** (`し` → `si`/`shi`/`ci`, `じゃ` → `zya`/`ja`/`jya`, etc.). A `TypingState` holds `patterns`, the current `unitIndex`, a per-mora `buffer` of accepted keys, and the accumulated `typed` string. `typeKey` advances by:

1. Appending the key to `buffer` and keeping candidates that still start with it.
2. Committing the mora when `buffer` exactly matches a candidate **and no longer candidate is still viable** — this is why `ん` typed as `n` doesn't commit immediately (waits for the next key to disambiguate `n`/`nn`/`na`…).
3. Falling back: if the current `buffer` already fully matches a candidate, commit that mora first, then retry the key against the next mora (handles `ん` → `nk` = commit `n`, start `k`).

Context-dependent moras are resolved in `buildPatterns` (`patterns.ts`) by walking units **right to left**:

- **`ん`** — needs `nn`/`xn` when followed by a vowel, `n`/`y`, or when it is the final mora (`requiresDoubleN`). Otherwise `n` is also allowed.
- **`っ`** — candidates are the doubled leading consonants of every next-mora candidate (so `った` accepts `tta`, `っち` accepts both `tti` and `cchi`), plus `ltu`/`xtu`/`ltsu` fallbacks (`sokuonCandidates`).

`romajiDisplay` returns `{typed, remaining}` where `remaining` reflects the currently chosen spelling branch (e.g. once `s` is typed for `し`, `remaining` stays on the `si`/`shi` branch that starts with `s`).

`buildPatterns` throws `未対応のかな文字です` on unknown kana — surface that as a real question-data bug (caught by `questions.test.ts`), not a runtime edge case to swallow.

### Adding things

- **New kana**: add its candidates to `MORA_TABLE` in `src/domain/romaji/moraTable.ts`.
- **New question**: add to `src/domain/questions/questions.ts`; `questions.test.ts` catches unsupported kana at test time.
- **New phase**: extend `GameState`/`GameEvent` and the `transition` switch in `src/domain/game/machine.ts`, extend `GameView` in `view.ts`, then handle the new phase in `TypingScreen`'s `PlayfieldCenter`.
- **New sound effect**: add it to `GameSound` in `src/domain/game/effects.ts` and map it in `SOUND_NAMES` in `src/services/sound.ts`.

### Styling

Tailwind v4 with tokens defined in `src/app/index.css` via `@theme` (`bg-canvas`, `text-ink`, `font-round`, `font-mono`, etc.). Fonts are self-hosted through `@fontsource/*` — do not add Google Fonts `<link>` tags.

## Repo conventions

- Comments in source are Japanese and explain the **why** (invariants, context-dependent branches). Match that style; don't add English narration of what code does.
- Local imports use explicit `.ts`/`.tsx` extensions (required by the TS config). Keep them when adding new imports.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **Bun** (pinned in `mise.toml`). Use `bun` / `bunx`, not `npm`/`pnpm`.

- `bun run dev` — start Vite dev server
- `bun run build` — type-check (`tsc -b`) then build
- `bun run test` — run Vitest once (`vitest run`; runs the `unit` and `browser` projects together)
- `bun run test:unit` — node-only project (domain layer / pure logic)
- `bun run test:browser` — React component tests on Playwright + Chromium
- `bun run test:coverage` — run both projects with V8 coverage (writes `coverage/index.html` + lcov)
- `bunx vitest run src/domain/romaji/typing.test.ts` — run a single test file
- `bunx vitest run -t "拗音"` — run tests matching a name
- `bun run lint` — oxlint
- `bun run fmt` / `bun run fmt:check` — oxfmt (formatter)
- `mise run bootstrap` — first-time setup (`bun install` + `lefthook install`)
- `bunx playwright install chromium` — one-time browser install for browser mode (needed before the first `bun run test:browser`)

Pre-commit hook (lefthook) runs `gitleaks`, `oxfmt --fix`, and `oxlint --fix` on staged files and re-stages fixes.

## Architecture

Single-page React 19 + Vite + Tailwind v4 typing game for Japanese input. React Compiler is enabled via `@rolldown/plugin-babel` in `vite.config.ts` — do not add `useMemo`/`useCallback` for optimization purposes.

### Layer split

Dependencies flow one way: `domain` ← `services` ← `features` ← `pages` ← `app`. `src/domain/*` has zero React or cuelume imports and is where all the unit-tested logic lives; `services` and `features` adapt it to the outside world; `pages` composes features into per-route screens; `app` wires the router.

- `src/domain/romaji/` — kana→romaji input engine.
  - `moraTable.ts` — `MORA_TABLE` (per-mora candidate spellings) and `SOKUON_FALLBACKS`.
  - `patterns.ts` — `buildPatterns` splits kana into moras and resolves context-dependent candidates.
  - `typing.ts` — `TypingState`, `createTypingState`, `typeKey`, `isFinished`, `romajiDisplay`.
- `src/domain/game/` — pure game state machine; no timers or sound calls of its own.
  - `machine.ts` — `GameState` (`idle`/`countdown`/`playing`/`done`), `GameEvent`, `transition`. `playing` and `done` carry `PlayingStats` (`correctKeys`, `wrongKeys`, `startedAt`); `done` also carries `endedAt`. Every `GameEvent` except `restart` carries a `now: number` — the caller stamps `Date.now()` at event time so `transition` can capture `startedAt`/`endedAt` at the countdown→playing and final→done transitions while staying pure.
  - `effects.ts` — `GameEffect`/`GameSound`/`ScheduledEvent`; effects are returned as data, not executed. `schedule.event` is the `now`-less `ScheduledEvent` variant since the caller stamps `now` when the timer fires.
  - `view.ts` — `selectView` projects `GameState` into `GameView`, the only thing React reads. For `done`, it embeds `computeResult(stats, endedAt)` as `result`.
  - `score.ts` — `computeResult` derives `GameResult` (`correctKeys`, `wrongKeys`, `totalKeys`, `elapsedMs`, `score`) from `PlayingStats` + `endedAt`. Score is `max(0, correctKeys*10 - wrongKeys*5 - floor(elapsedMs/1000))`.
- `src/domain/questions/` — `Question`/`QuestionSet` types, the `questionSets` list, and the `findQuestionSet(id)` lookup. Complex enough to plan for multiple sets (テーマ別・難易度別を将来増やす想定) so the game surface is keyed on `QuestionSet.id` — that id is what `/play/$setId` carries in the URL. `QuestionSet` also carries `category` (a grouping label, e.g. `どうぶつ`; not yet surfaced in the UI) and `questionCount` (how many questions to actually play per round — `questions` is a pool that can be larger than what's played). `questions.test.ts` asserts `questionSets` is non-empty, every set has a non-empty unique `id`, every set has at least one question, every set's `category` is non-empty, every set's `questionCount` is between 1 and `questions.length` inclusive, and every question's `kana` produces at least one mora via `buildPatterns`, so bad question data (including an accidentally empty `kana`, which would otherwise slip through as a no-op empty pattern list, or a `questionCount` larger than the pool) fails CI instead of leaving the game stuck or crashing at runtime.
  - `select.ts` — `selectQuestions(pool, count, random = Math.random)`: a pure Fisher-Yates shuffle of `pool` sliced to `count`, so a single call both picks which questions are played and randomizes their order. `random` is injectable for deterministic tests; production code always omits it. Assumes `count <= pool.length` (guaranteed by `questions.test.ts`'s `questionCount` contract above) with no runtime guard, matching `buildPatterns`' "bad data fails CI, not at runtime" philosophy.
- `src/features/typing/` — React glue.
  - `useTypingGame.ts` — thin adapter: holds `GameState` in `useState` (the render's source of truth; `view` is derived from it via `selectView` on every render) and mirrors it into `stateRef` for synchronous reads from `dispatch`/timers. Accepts an unstamped `DispatchEvent` and stamps `now: Date.now()` before calling `transition`, which is why `useKeyboard` and timer callbacks don't touch time themselves. Executes the returned effects (`playSound` calls `services/sound.ts` directly; `schedule` sets a timer that re-sends the event later — via a `dispatchRef` kept fresh every render, so a stale render's `dispatch` closure never fires against outdated `questions` — tracked in a `Set` and cleared on unmount). Returns `{ view, restart }` — `restart` sends the `restart` event so the result screen can go back to idle.
  - `useKeyboard.ts` — normalizes `keydown` into `{ type: "key", key }` payloads (typed as `KeyboardSend`; no `now`): ignores modifier combos (`meta`/`ctrl`/`alt`), ignores non-single-character keys, `preventDefault`s Space, lowercases the key so Shift/CapsLock still register as intended. `useTypingGame` stamps `now` before forwarding to `transition`.
  - `components/` — presentation only. `TypingScreen` is the shell (progress bar → center → keyboard hint) and also hosts an always-mounted sr-only `aria-live` region announcing the countdown (a live region that only mounts once `countdown` starts would miss the first value, since `aria-live` doesn't announce content already present at mount). Its center slot swaps between `IdleMessage`, `CountdownMessage`, and `QuestionDisplay`. All three share `PhaseLayout`'s 3-row skeleton (furigana / headline / romaji); the headline row's height is a `min-height`, not a fixed height, so a wrapped question grows the row instead of overlapping the romaji row below, while idle/countdown/playing still stay visually aligned. `RomajiText` holds no typography of its own — font/size/weight/letter-spacing are inherited from `PhaseLayout`'s romaji row. `ResultScreen` is the `done`-phase screen: it renders the `GameResult` (キー数・ミス数・時間・スコア) and a「もういちど」button that calls `onRestart`; Space also restarts via `machine.ts`'s `done` phase treating `START_KEY` as `restart` (symmetric with idle start).
- `src/services/sound.ts` — adapter over cuelume's `play()`. `SOUND_NAMES` is typed `satisfies Record<GameSound, SoundName>`, so adding a `GameSound` without mapping it to a cuelume `SoundName` is a compile error.
- `src/pages/` — one component per route. Each page owns its own shell (`<main>` wrapper, layout) and composes `features/` inside. Adding a page never changes shared layout unless a common shell actually emerges.
  - `TopPage.tsx` — the `/` route. Owns the `<main>` grid shell, renders the app title and iterates `questionSets` into `<Link to="/play/$setId">` cards — one card per `questionSets` entry (currently 5: どうぶつ/たべもの/のりもの/スポーツ/がっこう), and any set appended to `questions.ts` grows the list automatically. Intentionally light on chrome (no marketing copy / how-to bullets) — the page is meant to be a selector, not a landing page.
  - `PlayPage.tsx` — the `/play/$setId` route. Reads `setId` via `useParams({ from: "/play/$setId" })`, resolves the `QuestionSet`, and owns `activeQuestions` state seeded via `selectQuestions(questionSet.questions, questionSet.questionCount)` — the actual `questionCount`-sized, shuffled subset played this round. Hands `activeQuestions` to `useTypingGame` (whose own contract is unchanged: it just plays whatever ordered list it's given) and branches on `view.phase` (`"done"` → `ResultScreen` with `view.result` and `restart`, otherwise `TypingScreen`). A `previousPhaseRef`-gated `useEffect` re-selects `activeQuestions` only on a genuine `done` → `idle` transition (both the "もういちど" button's `restart()` and the Space-key restart via `machine.ts`'s `done`-phase `START_KEY` handling land on `view.phase === "idle"`, so one effect covers both) — the ref comparison (`previousPhaseRef.current !== "idle"`) specifically excludes the initial mount (whose phase is already `"idle"` from `createInitialState()`), so the `useState` lazy initializer's draw is the only one that ever runs at mount time, instead of being immediately discarded and redrawn. `questionSet` itself never changes across this component's lifetime because `router.ts`'s `playRoute` sets `remountDeps: ({ params }) => params`, forcing a full remount whenever `setId` changes — so `activeQuestions`/`useTypingGame`'s `GameState` can never end up holding a stale, mismatched set's data. Missing sets never reach here — `router.ts`'s `beforeLoad` redirects invalid `setId`s to `/`, so the inner `findQuestionSet` call is a belt-and-braces check that throws (should be unreachable in production).
- `src/app/` — composition root: `main.tsx` mounts `<RouterProvider router={router} />` and imports fonts/`index.css`; `router.ts` builds the route tree (`/` → `TopPage`, `/play/$setId` → `PlayPage` with a `beforeLoad` guard that `throw redirect({ to: "/" })`s when `findQuestionSet` fails, plus `remountDeps: ({ params }) => params` so a `setId` change always fully remounts `PlayPage` rather than reusing the instance — see the `PlayPage.tsx` note above) and exports both `routeTree` (for tests that need a memory-history router) and the browser-history `router` singleton, and augments `@tanstack/react-router`'s `Register` interface so `<Link to>`/`useParams`/`useNavigate` are type-checked against the actual tree. A dedicated NotFound screen for unknown `setId` is intentionally out of scope for now (silent redirect only).

### Game state machine (`src/domain/game/`)

`transition(state, event, questions)` is a pure function returning `{ state, effects }`; it never fires timers or sounds itself. This means the _conditions_ under which an effect fires (e.g. `playSound` on a wrong key, `schedule` after clearing a question) are covered by ordinary state-machine unit tests, not just by exercising the React tree. `transition` assumes `questions` is non-empty and every `kana` yields at least one mora (guaranteed by `questions.test.ts`) — it has no runtime guard for that contract, on purpose, since bad question data is meant to fail CI rather than be defended against at runtime.

Time enters the machine only through `event.now`. Every `GameEvent` except `restart` carries a `now: number` that the caller (`useTypingGame`) stamps at emit time. `transition` reads `event.now` at exactly two transitions — countdown→playing to set `stats.startedAt`, and final `advance` to set `done.endedAt`. Elsewhere `now` is ignored, so tests can pass any constant. This keeps `transition` pure while still letting the domain own the time-derived state.

Timers are represented as `schedule` effects that re-enter `transition` as a `ScheduledEvent` (`tick`, `advance`) after a delay. The stamped `now` is filled in by the timer callback, not by the effect payload, so a `schedule` effect only names which event type to send. Because the delayed event goes back through `transition`'s phase guards, a stale timer firing after the phase already moved on (e.g. an old `advance` arriving while already `idle`) is a no-op instead of a bug — no manual per-transition timer cancellation needed.

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
- **New question**: add to the appropriate `QuestionSet.questions` array in `src/domain/questions/questions.ts`; `questions.test.ts` catches unsupported kana at test time.
- **New question set**: append a new `QuestionSet` entry to `questionSets` in `src/domain/questions/questions.ts` with a unique `id` (URL-safe; goes into `/play/$setId`), a display `title`, a `category` label, a `questionCount` (≤ the pool size), and a `questions` pool (can be larger than `questionCount` — `PlayPage` randomly draws `questionCount` of them each round). No routing / UI changes needed — `TopPage` iterates `questionSets` and `router.ts`'s `beforeLoad` uses `findQuestionSet(id)` to resolve it. `questions.test.ts` re-runs against every set automatically, including the `category`/`questionCount` contract checks.
- **New phase**: extend `GameState`/`GameEvent` and the `transition` switch in `src/domain/game/machine.ts`, extend `GameView` in `view.ts`, then handle the new phase in `src/pages/PlayPage.tsx` (if it swaps the whole screen like `done`) or in `TypingScreen`'s `PlayfieldCenter` (if it sits inside the play shell).
- **New page/route**: add `src/pages/XxxPage.tsx`, then in `src/app/router.ts` create the route with `createRoute({ getParentRoute: () => rootRoute, path: "/xxx", component: XxxPage })` and append it to `rootRoute.addChildren([...])`. Dynamic segments use the `$name` prefix (see `/play/$setId`); typed params are read with `useParams({ from: "/xxx/$name" })` and links use `<Link to="/xxx/$name" params={{ name: "…" }}>`. Because the exported `router` is registered via `declare module "@tanstack/react-router" { interface Register { router: typeof router } }`, `<Link to="/xxx">` is compile-checked and a typo like `to="/xxxx"` fails `bun run build`.
- **New sound effect**: add it to `GameSound` in `src/domain/game/effects.ts` and map it in `SOUND_NAMES` in `src/services/sound.ts`.
- **Change the score formula**: edit the constants and body of `computeResult` in `src/domain/game/score.ts`; `score.test.ts` pins the expected score as literal numbers (never as expressions over the same constants), so updating a constant deliberately breaks the assertions until you re-derive them by hand.

### Styling

Tailwind v4 with tokens defined in `src/app/index.css` via `@theme` (`bg-canvas`, `text-ink`, `font-round`, `font-mono`, etc.). Fonts are self-hosted through `@fontsource/*` — do not add Google Fonts `<link>` tags.

### Testing

`vitest.config.ts` splits tests into two projects under `test.projects`.

- **`unit` project** — `src/**/*.test.ts` on node. Domain-layer pure logic lives here; no React or CSS is loaded, so this project stays fast and is where behavioral regressions get pinned.
- **`browser` project** — `src/**/*.browser.test.{ts,tsx}` on Playwright + Chromium. React component DOM, a11y, and Tailwind-driven styling are verified in a real browser. `src/test/browser-setup.ts` pulls in `@vitest/browser/matchers` (module augmentation for `toBeInTheDocument`, `toBeVisible`, etc.), `vitest-browser-react`, and `src/app/index.css` so Tailwind tokens (`bg-canvas`, `bg-accent`, …) are applied during tests. The test shape is `import { render } from "vitest-browser-react"` → `const screen = await render(<Component />)` → `await expect.element(screen.getByRole(...)).toBeVisible()`. Note `render` is async — always `await` it.
- Playwright's Chromium must be installed once with `bunx playwright install chromium`. The same applies on CI and on fresh clones.
- **Coverage** — `bun run test:coverage` uses `@vitest/coverage-v8` (v8 works on both node and Chromium, so unit + browser results are merged into a single report). Config lives at the root `test.coverage` block in `vitest.config.ts` (coverage is a global option in Vitest 4, not per-project). `include: ["src/**/*.{ts,tsx}"]` deliberately reports files that no test imports as 0%, so gaps are visible; `src/test/**`, `main.tsx`, and `*.test.*` files are excluded. Reports land in `coverage/` (gitignored) — open `coverage/index.html` locally, or feed `coverage/lcov.info` to CI.

## Repo conventions

- Comments in source are Japanese and explain the **why** (invariants, context-dependent branches). Match that style; don't add English narration of what code does.
- Local imports use explicit `.ts`/`.tsx` extensions (required by the TS config). Keep them when adding new imports.

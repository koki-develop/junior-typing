---
paths:
  - "src/domain/**"
---

# Domain layer rules

`src/domain/` is pure logic with zero React/cuelume imports. Behavior is pinned by node unit tests (the `unit` project).

## Bad data fails CI, not at runtime

The question-data contract (every `kana` resolves via `buildPatterns`, `questionCount <= questions.length`, unique `id`s, etc.) is guaranteed by `questions.test.ts`. Domain functions do not defend this contract with runtime guards — `buildPatterns` throws on unsupported kana, but that is a question-data bug meant to be caught by tests, not an edge case to swallow.

## Game state machine (`src/domain/game/`)

- `transition(state, event, questions)` is a pure function returning `{ state, effects }`. Sounds and timers are returned as effect **data**, never executed here — execution belongs to the features layer (`useTypingGame`). The conditions under which an effect fires are covered by state-machine unit tests.
- Time enters only through `event.now` (carried by every event except `restart`; the caller stamps `Date.now()` at emit time). Tests can pass any constant.
- Scheduled delayed events re-enter `transition`'s phase guards, so a stale timer firing after the phase moved on is a no-op. Do not write per-transition timer cancellation.

## Romaji engine (`src/domain/romaji/`)

Kana is split into moras (拗音 like `きゃ` counts as one unit), and each mora carries multiple valid romaji spellings (`し` → `si`/`shi`/`ci`, etc.). Context-dependent candidates for `ん`/`っ` are resolved right-to-left in `buildPatterns`. For the mora-commit rules (e.g. the `n`/`nn` disambiguation for `ん`), see the comments in `typing.ts` and `typing.test.ts`.

## Adding things

- **New kana** → add its candidates to `MORA_TABLE` in `moraTable.ts`
- **New question / question set** → `questions.ts`. A set needs a unique URL-safe `id` (it goes into `/play/$setId`), a `category`, and a `questionCount` (≤ the pool size). No routing/UI changes needed — TopPage and the router follow automatically, and the contract checks in `questions.test.ts` apply automatically
- **New sound effect** → add it to `GameSound` in `game/effects.ts` and map it in `SOUND_NAMES` in `services/sound.ts` (a missing mapping is a compile error)
- **Score formula change** → `game/score.ts`. `score.test.ts` pins expected scores as literal numbers (never as expressions over the same constants), so re-derive them by hand when changing the formula

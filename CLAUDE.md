# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **Bun** (pinned in `mise.toml`). Use `bun` / `bunx`, not `npm`/`pnpm`.

- `bun run dev` — start Vite dev server
- `bun run build` — type-check (`tsc -b`) then build
- `bun run test` — run Vitest once (`unit` + `browser` projects)
- `bun run test:unit` / `bun run test:browser` — run a single project
- `bun run test:coverage` — V8 coverage for both projects (writes `coverage/index.html` + lcov)
- `bunx vitest run src/domain/romaji/typing.test.ts` — run a single test file
- `bunx vitest run -t "拗音"` — run tests matching a name
- `bun run lint` — oxlint
- `bun run fmt` / `bun run fmt:check` — oxfmt
- `mise run bootstrap` — first-time setup (`bun install` + `lefthook install`)
- `bunx playwright install chromium` — one-time browser install, required before the first `bun run test:browser` (also on CI / fresh clones)

Pre-commit hook (lefthook) runs `gitleaks`, `oxfmt --fix`, and `oxlint --fix` on staged files and re-stages fixes.

## Architecture

Single-page React 19 + Vite + Tailwind v4 typing game for Japanese input. Dependencies flow one way:

`domain` ← `services` ← `features` ← `pages` ← `app`

- `src/domain/` — pure logic, zero React/cuelume imports. `romaji/` (kana→romaji input engine), `game/` (game state machine), `questions/` (question data + selection)
- `src/services/` — adapters to the outside world (`sound.ts` over cuelume)
- `src/features/` — React glue: hooks and presentational components
- `src/pages/` — one component per route; each page owns its own `<main>` shell
- `src/app/` — composition root: router (TanStack Router, type-registered so bad `<Link to>` paths fail `bun run build`), `main.tsx`, `index.css`, `meta.ts` (site title/description strings, single source of truth for the `head` route option below). Per-route `<title>`/`<meta name="description">` are set via each route's `head` option and rendered by `<HeadContent />` in `rootRoute`; `index.html` carries the same text statically as the pre-hydration/no-JS fallback and can't import from `meta.ts` (it's a separate static asset), so `src/app/meta.test.ts` asserts the two stay in sync.

React Compiler is enabled via `@rolldown/plugin-babel` in `vite.config.ts` — do not add `useMemo`/`useCallback` for optimization purposes.

## Conventions

- Comments in source are Japanese and explain the **why** (invariants, context-dependent branches). Match that style; don't add English narration of what code does. Non-obvious design decisions live in these comments, not in this file — keep it that way.
- Local imports use explicit `.ts`/`.tsx` extensions (required by the TS config).
- Tailwind v4 with tokens defined in `src/app/index.css` via `@theme` (`bg-canvas`, `text-ink`, `font-round`, `font-mono`, etc.).
- Fonts are self-hosted through `@fontsource/*` — do not add Google Fonts `<link>` tags.

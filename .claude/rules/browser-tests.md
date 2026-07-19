---
paths:
  - "src/**/*.browser.test.{ts,tsx}"
---

# Browser test rules

Vitest is split into two projects under `test.projects` in `vitest.config.ts`:

- `unit` — `src/**/*.test.ts`, runs on node. For pure domain logic (no React/CSS loaded, so it stays fast)
- `browser` — `src/**/*.browser.test.{ts,tsx}`, runs on Playwright + Chromium. For DOM, a11y, and Tailwind-driven styling

## Test shape

```tsx
import { render } from "vitest-browser-react";

const screen = await render(<Component />);
await expect.element(screen.getByRole("...")).toBeVisible();
```

- `render` is async — always `await` it
- Matcher augmentation (`toBeInTheDocument`, etc.) and Tailwind tokens (`bg-canvas`, etc.) are loaded by `src/test/browser-setup.ts` — do not re-import them in tests

## Environment

Playwright's Chromium must be installed once with `bunx playwright install chromium` (same on CI and fresh clones).

// @vitest/browser/matchers は expect.element に toBeInTheDocument / toBeVisible などの
// jest-dom 互換マッチャを生やす module augmentation を持つ。副作用インポートで TS に拾わせる。
import "@vitest/browser/matchers";
// vitest-browser-react は BrowserPage に render / renderHook を augment する。
import "vitest-browser-react";

// Tailwind v4 のトークン（bg-canvas / text-ink / font-round など）を browser 側にも通す。
// 実アプリ (src/app/main.tsx) と同じ CSS 一式を読み込むことで、テストで観測する DOM に
// アプリ本番と同じスタイル（色 / タイポグラフィ / アニメーション）が適用される。
import "../app/index.css";

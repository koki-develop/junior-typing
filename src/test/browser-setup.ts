// @vitest/browser/matchers は expect.element に toBeInTheDocument / toBeVisible などの
// jest-dom 互換マッチャを生やす module augmentation を持つ。副作用インポートで TS に拾わせる。
import "@vitest/browser/matchers";
// vitest-browser-react は BrowserPage に render / renderHook を augment する。
import "vitest-browser-react";
import { MotionGlobalConfig } from "motion/react";

// Tailwind v4 のトークン（bg-canvas / text-ink / font-round など）を browser 側にも通す。
// 実アプリ (src/app/main.tsx) と同じ CSS 一式を読み込むことで、テストで観測する DOM に
// アプリ本番と同じスタイル（色 / タイポグラフィ / アニメーション）が適用される。
import "../app/index.css";

// motion のアニメーション（AnimatePresence の enter/exit フェード等）をテスト時は即完了させる。
// アニメーションの完了は rAF ベースで動くため、テスト実行後に非同期の React state 更新が走り、
// act(...) 外で "An update to AnimatePresence inside a test was not wrapped in act" 警告が出る。
// テストが検証するのは「最終的にその要素が見えるか」であって遷移の途中フレームではないので、
// フェードを丸ごと飛ばして期待状態を即時に反映させることで警告と実時間の待ちを一括で潰す。
MotionGlobalConfig.skipAnimations = true;

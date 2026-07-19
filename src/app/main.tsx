import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import "@fontsource/m-plus-rounded-1c/400.css";
import "@fontsource/m-plus-rounded-1c/500.css";
import "@fontsource/m-plus-rounded-1c/700.css";
import "@fontsource/m-plus-rounded-1c/800.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import "./index.css";
import { router } from "./router.tsx";
import { bindInteractionSounds } from "../services/sound.ts";

// data-cuelume-hover / data-cuelume-press 属性による効果音を document 全体に対して
// 一度だけ有効化する。委譲リスナーなので後から追加される DOM（TanStack Router の
// 画面遷移で入れ替わるカードなど）にも再バインド不要で効く。
bindInteractionSounds();

// index.html の静的 <title>/<meta name="description"> は JS 実行前（pre-hydration・非JSクローラー）
// 向けのフォールバック。React 19 の <title>/<meta> 自動 hoisting は React 自身が描画したタグ同士でしか
// dedupe せず、この静的タグは検知・除去してくれないため、放置すると rootRoute の head が追加する
// タグと二重に残ってしまう（play ページでは新旧の title が両方 DOM に残る不整合になる）。
// createRoot().render() は初回マウントを同期的にコミットするため、直前に外しても表示上の
// フラッシュは発生しない。
document.querySelector("title")?.remove();
document.querySelector('meta[name="description"]')?.remove();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

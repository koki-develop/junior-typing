import { describe, expect, it } from "vitest";
// ?raw は Vite 組み込みの文字列インポート（vite/client の型定義でカバーされる）で、
// src/ の tsconfig.app.json が node 組み込みモジュールの型を持たないためこちらを使う。
import indexHtml from "../../index.html?raw";
import { SITE_DESCRIPTION, TOP_TITLE } from "./meta.ts";

// index.html は SPA の pre-hydration / JS 非実行クローラー向けフォールバックとして title/description を
// 静的に持つ。JS 側（meta.ts）だけ文言を変更して index.html の更新を忘れる、というドリフトをここで検知する。

describe("index.html は meta.ts の文言と同期している", () => {
  it("title が TOP_TITLE と一致する", () => {
    expect(indexHtml).toContain(`<title>${TOP_TITLE}</title>`);
  });

  it("meta description の content が SITE_DESCRIPTION と一致する", () => {
    expect(indexHtml).toContain(`content="${SITE_DESCRIPTION}"`);
  });
});

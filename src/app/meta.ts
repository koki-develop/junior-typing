// サイト全体で共有する title/description の文言。router.tsx（head option）から使う一次情報源。
// index.html は SPA の pre-hydration / JS 非実行クローラー向けフォールバックとして同じ文言を
// 静的に持っており、そちらは自動連携できないため手動で同期する。ズレは meta.test.ts が検知する。
export const SITE_TITLE = "ジュニアタイピング";
// トップページのタイトル。/play/$setId 側は SITE_TITLE をサフィックスとして使う（router.tsx の playRoute）。
export const TOP_TITLE = `${SITE_TITLE} | 小学生のためのタイピング練習`;
export const SITE_DESCRIPTION =
  "ひらがな入力からいきもの・たべものなどのお題まで、小学生向けタイピング練習アプリ。ローマ字入力の基本を、パソコンで楽しく学べます。";

import { defineConfig } from "vitest/config";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";

// domain 層の純ロジックは node で速く回し、React コンポーネントは実ブラウザで検証する。
// vite プラグイン（react / react-compiler / tailwind）は browser プロジェクトだけに載せる。
// unit プロジェクトはビルド不要な .ts なので、余計なトランスフォームを走らせない。
// coverage は projects 単位ではなく root の test.coverage に置く（Vitest 4 の仕様）。
// v8 provider は Chromium も対象なので、unit / browser 両プロジェクトの実行結果が合算される。
// include を明示することで、テストから一度も import されていない src 配下のファイルも
// 0% として可視化される（未指定だと import されたファイルしか表示されない）。
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.browser.test.{ts,tsx}",
        "src/test/**",
        "src/app/main.tsx",
      ],
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
          environment: "node",
        },
      },
      {
        plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.{ts,tsx}"],
          setupFiles: ["./src/test/browser-setup.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});

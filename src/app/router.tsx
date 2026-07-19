import {
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { findQuestionSet } from "../domain/questions/questions.ts";
import { PlayPage } from "../pages/PlayPage.tsx";
import { TopPage } from "../pages/TopPage.tsx";
import { SITE_DESCRIPTION, SITE_TITLE, TOP_TITLE } from "./meta.ts";

// rootRoute は共通シェルを持たない Outlet のみ。将来ページ間で共通のレイアウトが必要になったら
// ここに RootLayout を挟む。今は各ページが自前で <main> を保持している。
//
// ⚠ topology の暗黙前提: topRoute (/) と playRoute (/play/$setId) は rootRoute 直下に
// フラットに並んでいる（レイアウトを共有しない）ため、両者を行き来すると TopPage / PlayPage は
// 毎回 unmount → mount で入れ替わる。features/highScores/useHighScores はこの remount 前提に
// 依存して「マウント時 snapshot」でハイスコアを読む。もし将来 / と /play/$setId を包む
// 共通レイアウトルートをここに挟むと、TopPage は unmount されなくなり、useHighScores の
// snapshot が silent に stale になる。topology を変える人は useHighScores の実装を
// サブスクリプション方式に切り替えること。
//
// head で全ページ共通の title/description をデフォルト定義し、子ルートの head が同じ
// meta name（title / description）を返すとそちらで上書きされる（TanStack Router の
// ネスト時 dedupe）。charset・viewport・favicon は index.html 側の静的タグに任せており、
// ここでは扱わない（HeadContent は index.html 側のタグとは dedupe できないため）。
// <HeadContent /> は SPA（index.html を自前で持たない構成）向けの描画で、ページ遷移のたびに
// <head> 内の title/meta を差し替える。
const rootRoute = createRootRoute({
  head: () => ({
    meta: [{ title: TOP_TITLE }, { name: "description", content: SITE_DESCRIPTION }],
  }),
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
});

// title/description は rootRoute の head がそのまま出る（トップページ向けの文言と一致するため上書き不要）。
const topRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TopPage,
});

// /play/$setId は URL 直打ちで存在しない setId が渡る可能性があるため、
// beforeLoad で findQuestionSet に解決し、失敗したら / にリダイレクトして寡黙に握り潰す。
// 専用の NotFound 画面は今回はスコープ外（後日追加予定）。
//
// remountDeps: ({ params }) => params で、setId が変わるたびに PlayPage を完全に
// マウントし直す（TanStack Router がこれを React の key 変更として扱う）。現状 setId を
// マウントしたまま切り替える導線（別セットへのリンク等）は無いが、将来そういう導線が
// 追加されても PlayPage 内の activeQuestions や useTypingGame の GameState が
// 前のセットのデータを引きずったまま残るクラスのバグが構造的に起こらないようにするための
// ルーティング層での対策。ページ側で setId ごとに手動リセットするより、ここで「setId が
// 変わったら別ページとして扱う」と宣言する方が正しい置き所。
const playRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/play/$setId",
  beforeLoad: ({ params }) => {
    if (!findQuestionSet(params.setId)) {
      throw redirect({ to: "/" });
    }
  },
  remountDeps: ({ params }) => params,
  // beforeLoad が存在しない setId を redirect 済みなので、head 実行時点で questionSet は必ず解決する。
  // description は全ページ共通で SITE_DESCRIPTION を使う（title だけセットごとに変える）。
  head: ({ params }) => {
    const questionSet = findQuestionSet(params.setId)!;
    return {
      meta: [
        { title: `${questionSet.title} | ${SITE_TITLE}` },
        { name: "description", content: SITE_DESCRIPTION },
      ],
    };
  },
  component: PlayPage,
});

// routeTree はテストからも参照する（memory history で各ルートの解決を検証するため）。
export const routeTree = rootRoute.addChildren([topRoute, playRoute]);

export const router = createRouter({ routeTree });

// Register 型登録により <Link to="/存在しないパス"> がコンパイルエラーになり、
// useParams / useNavigate 等の型もこの routeTree から導出される。
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

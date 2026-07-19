import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { findQuestionSet } from "../domain/questions/questions.ts";
import { PlayPage } from "../pages/PlayPage.tsx";
import { TopPage } from "../pages/TopPage.tsx";

// rootRoute は共通シェルを持たない Outlet のみ。将来ページ間で共通のレイアウトが必要になったら
// ここに RootLayout を挟む。今は各ページが自前で <main> を保持している。
const rootRoute = createRootRoute({ component: Outlet });

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

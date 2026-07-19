import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { HomePage } from "../pages/HomePage.tsx";

// rootRoute は共通シェルを持たない Outlet のみ。将来ページ間で共通のレイアウトが必要になったら
// ここに RootLayout を挟む。今は HomePage が自前で <main> を保持している。
const rootRoute = createRootRoute({ component: Outlet });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

// routeTree はテストからも参照する（memory history で `/` → HomePage の解決を検証するため）。
export const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });

// Register 型登録により <Link to="/存在しないパス"> がコンパイルエラーになり、
// useParams / useNavigate 等の型もこの routeTree から導出される。
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

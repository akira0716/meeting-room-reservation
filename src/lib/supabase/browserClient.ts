import { createBrowserClient } from "@supabase/ssr";

/**
 * クライアントコンポーネントから使うSupabaseクライアント（Googleサインインなどに使用）。
 *
 * cookieOptionsを明示しているのは、Google OAuthのようにGoogle→Supabase→自アプリと
 * 複数ドメインをまたいでリダイレクトが返ってくるフローで、PKCEのcode_verifierを
 * 保存したCookieが最終リダイレクト時に送信されない問題（SameSite=Strictだと
 * クロスサイトのトップレベルナビゲーションでCookieが送られない）を避けるため。
 * SameSite=Laxならトップレベルの遷移（リダイレクト含む）ではCookieが送信される。
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        sameSite: "lax",
      },
    },
  );
}

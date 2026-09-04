import { createBrowserClient } from "@supabase/ssr";

/**
 * クライアントコンポーネントから使うSupabaseクライアント（Googleサインインなどに使用）。
 *
 * cookieOptionsを明示しているのは2点対策するため：
 * 1. SameSite=Lax：Google OAuthはGoogle→Supabase→自アプリと複数ドメインをまたいで
 *    リダイレクトが返ってくる。SameSite=Strict（デフォルト）だとクロスサイトの
 *    トップレベルナビゲーションでCookieが送信されない
 * 2. path="/"：明示しないと、Cookieを設定したページ（例: /login）にPathが
 *    紐づいてしまい、別のページ（/auth/callback）からはブラウザに保存されていても
 *    読み取れなくなる（PKCEのcode_verifierが見つからないエラーの原因になっていた）
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        sameSite: "lax",
        path: "/",
      },
    },
  );
}

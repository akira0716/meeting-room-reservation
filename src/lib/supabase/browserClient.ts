import { createBrowserClient } from "@supabase/ssr";

/**
 * クライアントコンポーネントから使うSupabaseクライアント（マジックリンクの送信などに使用）。
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Component / Route Handler / Server Actionから使う、Cookieベースのセッションを扱うSupabaseクライアント。
 * secret keyを使うserverClient.ts（Storageアップロード等、RLSをバイパスする管理操作用）とは役割が異なる。
 */
export async function createSupabaseAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Componentのレンダリング中はCookieを書き換えられないため無視する。
            // セッションのリフレッシュ自体はmiddleware.tsが担う。
          }
        },
      },
    },
  );
}

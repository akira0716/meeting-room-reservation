import { createClient } from "@supabase/supabase-js";

/**
 * サーバー専用のSupabaseクライアント。secret keyでRLSをバイパスするため、
 * ブラウザに渡す値には絶対に使わない（Route Handler等のサーバーコードでのみimportする）。
 *
 * 現状は認証・認可(管理者ページ)が未実装のため、このクライアントを使うAPIは
 * 暫定的に「誰でも呼べる」状態になっている。TASKS.mdに記載のとおり、
 * 認証実装時に管理者権限チェックを追加すること。
 */
export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY is not set. .env.exampleを参照してください。",
    );
  }

  return createClient(url, secretKey, {
    auth: { persistSession: false },
  });
}

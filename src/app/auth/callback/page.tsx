import { Suspense } from "react";
import { AuthCallbackHandler } from "@/components/AuthCallbackHandler";

/**
 * マジックリンク／招待リンクのクリック後に戻ってくるコールバックページ。
 *
 * Supabaseが発行するリンクには2パターンある：
 * 1. ブラウザから signInWithOtp() を呼んで届いたメール（自分でパスワード再設定等をした場合）
 *    → 認証情報は "?code=..." というクエリ文字列で返ってくる（PKCEフロー）
 * 2. サーバー側の管理API（inviteUserByEmail / generateLink）で発行したメール
 *    → 認証情報は "#access_token=...&refresh_token=..." というURLのハッシュ部分で返ってくる
 *      （ハッシュはブラウザからサーバーに送信されないため、サーバー側のRoute Handlerでは
 *      検知できず、クライアント側のJavaScriptで読み取る必要がある）
 *
 * 両方に対応するため、このページはクライアントコンポーネントとして実装している。
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackMessage />}>
      <AuthCallbackHandler />
    </Suspense>
  );
}

function CallbackMessage() {
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <p className="text-sm text-neutral-500">サインインしています...</p>
    </main>
  );
}

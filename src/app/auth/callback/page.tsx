import { Suspense } from "react";
import { AuthCallbackHandler } from "@/components/AuthCallbackHandler";

/**
 * OAuth（Googleサインイン）のリダイレクト後に戻ってくるコールバックページ。
 *
 * ブラウザから signInWithOAuth() を呼んで開始したフローは、Google認証後に
 * "?code=..." というクエリ文字列付きで戻ってくる（PKCEフロー）。
 *
 * それとは別に、Supabaseの管理API（generateLink等）で発行したリンクは
 * "#access_token=...&refresh_token=..." というURLのハッシュ部分で認証情報が返る
 * パターンもある（ハッシュはブラウザからサーバーに送信されないため、サーバー側の
 * Route Handlerでは検知できず、クライアント側のJavaScriptで読み取る必要がある）。
 * このアプリでは現在ユーザー向けの導線としては使っていないが、開発時の動作確認
 * （メール送信を伴わないリンク発行）で使うため、両方に対応させている。
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

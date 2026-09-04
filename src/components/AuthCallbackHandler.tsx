"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";

export function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  // Reactの開発モードはeffectを意図的に2回実行するため、ここでガードしないと
  // 1回目でコード(1回限り有効)を使い切り、2回目が「既に使われたコード」で失敗してしまう。
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    async function run() {
      const supabase = createSupabaseBrowserClient();
      const next = searchParams.get("next") ?? "/";

      try {
        // パターン1：URLのハッシュにaccess_token/refresh_tokenが含まれる場合
        // （generateLinkなど、サーバー側で発行したリンク）
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            console.error("[auth/callback] setSession failed:", error);
            setError(`サインインに失敗しました（setSession: ${error.message}）`);
            return;
          }
          router.replace(next);
          return;
        }

        // パターン2：?code= が含まれる場合（signInWithOAuth等のPKCEフロー）
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[auth/callback] exchangeCodeForSession failed:", error);
            setError(`サインインに失敗しました（exchangeCodeForSession: ${error.message}）`);
            return;
          }
          router.replace(next);
          return;
        }

        // どちらのパターンにも該当しない = Supabaseから認証情報が返ってきていない
        const errorDescription = searchParams.get("error_description");
        console.error(
          "[auth/callback] no code/hash tokens found. search:",
          window.location.search,
          "hash:",
          window.location.hash,
        );
        setError(
          errorDescription
            ? `サインインに失敗しました（${errorDescription}）`
            : "サインインに失敗しました（認証情報を受け取れませんでした）",
        );
      } catch (err) {
        console.error("[auth/callback] unexpected error:", err);
        setError(
          `サインイン処理中に予期しないエラーが発生しました：${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    run();
  }, [router, searchParams]);

  if (error) {
    return (
      <main className="mx-auto max-w-sm px-6 py-16">
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        <a href="/login" className="mt-2 inline-block text-sm underline underline-offset-2">
          サインイン画面に戻る
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <p className="text-sm text-neutral-500">サインインしています...</p>
    </main>
  );
}

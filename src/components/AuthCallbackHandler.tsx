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
        if (!error) {
          router.replace(next);
          return;
        }
      }

      // パターン2：?code= が含まれる場合（signInWithOAuth等のPKCEフロー）
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          router.replace(next);
          return;
        }
      }

      setError("サインインに失敗しました。リンクの有効期限が切れている可能性があります。");
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

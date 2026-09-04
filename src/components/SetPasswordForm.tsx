"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";

export function SetPasswordForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setStatus("error");
      setError("パスワードは8文字以上にしてください");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setError("パスワードが一致しません");
      return;
    }

    setStatus("saving");
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div>
        <label className="block text-xs font-medium text-neutral-500">新しいパスワード</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-500">確認のため再入力</label>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
        />
      </div>
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {status === "saving" ? "設定中..." : "パスワードを設定する"}
      </button>
    </form>
  );
}

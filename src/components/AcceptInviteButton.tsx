"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";

export function AcceptInviteButton({ email, token }: { email: string; token: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setStatus("sending");
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          `/invite/${token}/accept`,
        )}`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <p className="text-sm text-emerald-600 dark:text-emerald-400">
        {email} 宛にサインイン用のリンクを送信しました。メール内のリンクを開くと参加が完了します。
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "sending"}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {status === "sending" ? "送信中..." : `${email} でサインインして参加する`}
      </button>
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

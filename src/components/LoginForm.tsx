"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";

function MagicLinkForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const setPasswordNext = `/set-password${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(setPasswordNext)}`,
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
        {email} 宛にリンクを送信しました。メール内のリンクを開くと、パスワードを設定できます。
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div>
        <label className="block text-xs font-medium text-neutral-500">メールアドレス</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
        />
      </div>
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {status === "sending" ? "送信中..." : "リンクを送る"}
      </button>
    </form>
  );
}

function PasswordSignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus("error");
      setError(
        error.message === "Invalid login credentials"
          ? "メールアドレスまたはパスワードが違います"
          : error.message,
      );
      return;
    }

    router.push(next ?? "/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div>
        <label className="block text-xs font-medium text-neutral-500">メールアドレス</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-500">パスワード</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
        />
      </div>
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {status === "sending" ? "サインイン中..." : "サインイン"}
      </button>
    </form>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"password" | "magic-link">("password");

  return (
    <div>
      {mode === "password" ? (
        <PasswordSignInForm next={next} />
      ) : (
        <MagicLinkForm next={next} />
      )}
      <button
        type="button"
        onClick={() => setMode(mode === "password" ? "magic-link" : "password")}
        className="mt-3 text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        {mode === "password"
          ? "初めての方・パスワードを忘れた方はこちら"
          : "パスワードでサインインする"}
      </button>
    </div>
  );
}

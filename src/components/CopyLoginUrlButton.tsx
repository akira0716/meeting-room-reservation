"use client";

import { useState } from "react";

/**
 * ログインURL（/login）をクリップボードにコピーするボタン。
 * サインインは全員同じ「Googleでサインイン」ボタンを押すだけなので、URLは
 * ユーザーごとに異なるものではない。管理者が招待相手に共有するために使う。
 */
export function CopyLoginUrlButton({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = `${window.location.origin}/login`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("このURLをコピーしてください", url);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        className ??
        "text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
      }
    >
      {copied ? "コピーしました" : "ログインURLをコピー"}
    </button>
  );
}

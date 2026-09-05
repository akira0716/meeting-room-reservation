"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * 右上のアカウントメニュー。Googleアカウントのアバター画像をボタンにし、
 * クリックで開閉するポップオーバーに氏名・メールアドレス・ログアウトボタンをまとめる。
 *
 * 「ホバーで表示」も検討したが、ホバー状態はタッチ操作（スマホ・タブレット）には
 * 存在せず、その中に移すログアウトボタンに永久に手が届かなくなる恐れがあるため、
 * クリック（タップ）で開閉する方式にしている。
 *
 * ログアウトボタン（`LogoutButton`）はServer Component（内部でAuth.js/DBに依存する
 * Server Actionを持つ）のため、Client Componentであるこのファイルから直接import
 * すると、そのままクライアントバンドルに含めようとしてビルドが失敗する
 * （postgresなどNode専用モジュールの解決エラー）。呼び出し側（Server Component）
 * からchildrenとして渡してもらう構成にしている。
 */
export function AccountMenu({
  email,
  name,
  image,
  children,
}: {
  email: string;
  name: string | null;
  image: string | null;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // メニュー外のクリックで閉じる
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const initial = (name ?? email).trim().charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="アカウントメニュー"
        aria-expanded={isOpen}
        className="block h-8 w-8 shrink-0 overflow-hidden rounded-full border border-black/10 hover:opacity-80 dark:border-white/10"
      >
        {image ? (
          <Image src={image} alt="" width={32} height={32} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-neutral-200 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200">
            {initial}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-md border border-black/10 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-neutral-900">
          {name && <p className="text-sm font-medium">{name}</p>}
          <p className="truncate text-xs text-neutral-500">{email}</p>
          <div className="mt-3 border-t border-black/5 pt-2 dark:border-white/5">{children}</div>
        </div>
      )}
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { LandingFloorMap } from "./LandingFloorMap";

/**
 * ログイン（/login）・サインアップ（/signup）で共通利用する2カラムの画面枠。
 * LP（LandingPage.tsx）のダーク×ミントのブランドを引き継ぎ、LPからの導線で
 * 世界観が途切れないようにしている。
 *
 * 実際の`/login`と`/signup`は別ページ（別のサインイン方式・Server Action）のため、
 * デザイン案にあった「同じ画面内でモードを切り替える」ボタンではなく、単純な
 * ページ遷移リンク（switchHref）にしている。
 *
 * 左側の説明カラムは、狭い画面では表示しない（`hidden sm:flex`）。ログイン画面は
 * 招待メールのリンク等からスマホで開かれることも多く、その場合はマーケティング
 * コピーより先にサインインボタンへすぐ辿り着けた方が使いやすいと判断した。
 */
export function AuthScreen({
  title,
  lead,
  error,
  switchHref,
  switchLabel,
  children,
}: {
  title: string;
  lead: string;
  error?: string;
  switchHref: string;
  switchLabel: string;
  /** サインイン／サインアップの実際のフォーム（Server Actionを含む）。ページ側で用意する */
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 sm:grid-cols-2">
      <div className="hidden flex-col justify-between gap-12 bg-[#0a0a0a] p-14 text-[#ededed] sm:flex">
        <div className="flex items-center gap-2.5">
          <div className="h-[26px] w-[26px] rounded-[7px] bg-emerald-200" />
          <span className="font-mono text-[15px] font-medium tracking-wide">Roomap</span>
        </div>

        <div className="flex max-w-[38ch] flex-col gap-5">
          <h2 className="text-[clamp(24px,2.8vw,32px)] font-bold leading-[1.4] tracking-tight">
            会議室の空き状況と位置を、迷わず予約できる。
          </h2>
          <p className="text-sm leading-[1.9] text-neutral-400">
            サインインすると、登録済みのフロアマップがそのまま開きます。
          </p>
          <div className="overflow-hidden rounded-xl border border-neutral-800">
            <LandingFloorMap className="rounded-xl" />
          </div>
        </div>

        <span className="font-mono text-[11px] text-neutral-600">
          招待されたメンバーのみサインインできます
        </span>
      </div>

      {/* このAuthScreenはLPと同じく固定の配色（右カラムは常にライト）で設計しており、
          OSのダークモード設定に追従させる意図は無い。bg-whiteを明示しないと、
          body側のCSS変数（prefers-color-scheme:darkで暗転する）がそのまま透けて
          しまい、意図せずダーク表示になる */}
      <div className="flex items-center justify-center bg-white px-8 py-14 text-neutral-900">
        <div className="w-full max-w-[380px]">
          <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
          <p className="mt-2.5 text-sm leading-[1.85] text-neutral-600">{lead}</p>

          {error && (
            <div className="mt-5 flex gap-2.5 rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3.5">
              <span className="shrink-0 font-mono text-xs text-rose-800">!</span>
              <p className="text-[13px] leading-[1.8] text-rose-800">{error}</p>
            </div>
          )}

          <div className="mt-6">{children}</div>

          <div className="my-7 h-px bg-neutral-200" />

          <Link
            href={switchHref}
            className="text-[13px] text-emerald-700 underline underline-offset-2"
          >
            {switchLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

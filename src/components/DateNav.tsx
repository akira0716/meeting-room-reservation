"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDaysToDateKey } from "@/lib/dateKey";

/**
 * フロアマップに表示する日付を切り替えるナビ。前日・前週・翌日・翌週への
 * 移動と、日付を直接指定できる`<input type="date">`を提供する。
 *
 * 前日・翌日・前週・翌週はサーバー側の再取得（getFloorMapData）を伴うため、
 * 素朴に`<Link href="/?date=...">`にしている（クライアント側だけの状態変更では
 * 済まない。予約データそのものを別の日付分に取り直す必要があるため）。
 */
export function DateNav({ dateKey, isToday }: { dateKey: string; isToday: boolean }) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Link
        href={`/?date=${addDaysToDateKey(dateKey, -7)}`}
        className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        « 前週
      </Link>
      <Link
        href={`/?date=${addDaysToDateKey(dateKey, -1)}`}
        className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ‹ 前日
      </Link>
      <input
        type="date"
        value={dateKey}
        onChange={(e) => {
          if (e.target.value) router.push(`/?date=${e.target.value}`);
        }}
        className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/10"
      />
      {!isToday && (
        <Link
          href="/"
          className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          今日
        </Link>
      )}
      <Link
        href={`/?date=${addDaysToDateKey(dateKey, 1)}`}
        className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        翌日 ›
      </Link>
      <Link
        href={`/?date=${addDaysToDateKey(dateKey, 7)}`}
        className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        翌週 »
      </Link>
    </div>
  );
}

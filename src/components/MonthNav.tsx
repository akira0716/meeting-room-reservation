import Link from "next/link";
import { addMonthsToMonthKey, formatMonthLabel } from "@/lib/dateKey";

/** カレンダー画面の月ナビ（前月・翌月）。純粋な表示コンポーネントなのでServer Componentのまま使う */
export function MonthNav({ monthKey }: { monthKey: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link
        href={`/calendar?month=${addMonthsToMonthKey(monthKey, -1)}`}
        className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ‹ 前月
      </Link>
      <span className="font-medium">{formatMonthLabel(monthKey)}</span>
      <Link
        href={`/calendar?month=${addMonthsToMonthKey(monthKey, 1)}`}
        className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        翌月 ›
      </Link>
    </div>
  );
}

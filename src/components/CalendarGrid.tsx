"use client";

import Link from "next/link";
import { useState } from "react";
import { getMonthGridDateKeys, parseDateKey, toDateKey } from "@/lib/dateKey";
import type { CalendarReservation } from "@/lib/queries/getCalendarMonthData";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
/** 1つの枠に表示する「自分の予約」の最大件数。超えた分は「+N件」でまとめる */
const MAX_VISIBLE_PER_DAY = 2;

const timeFormatter = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" });

function DayCell({
  dateKey,
  monthKey,
  myReservations,
  isSelected,
  onSelect,
}: {
  dateKey: string;
  monthKey: string;
  myReservations: CalendarReservation[];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const date = parseDateKey(dateKey);
  const isCurrentMonth = dateKey.slice(0, 7) === monthKey;
  const isToday = dateKey === toDateKey(new Date());
  const visible = myReservations.slice(0, MAX_VISIBLE_PER_DAY);
  const overflowCount = myReservations.length - visible.length;

  return (
    <div
      onClick={onSelect}
      className={
        "flex min-h-24 cursor-pointer flex-col gap-1 rounded-md border p-1.5 text-xs " +
        (isSelected
          ? "border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-800"
          : "border-black/5 hover:bg-black/5 dark:border-white/5 dark:hover:bg-white/5") +
        (isCurrentMonth ? "" : " opacity-40")
      }
    >
      <span
        className={
          isToday
            ? "flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900"
            : "text-neutral-500"
        }
      >
        {date.getDate()}
      </span>

      <div className="flex-1 space-y-0.5">
        {visible.map((r) => (
          <p key={r.id} className="truncate text-neutral-600 dark:text-neutral-300">
            {timeFormatter.format(r.startAt)} {r.roomName}
          </p>
        ))}
        {overflowCount > 0 && <p className="text-neutral-400">+{overflowCount}件</p>}
      </div>

      <Link
        href={`/?date=${dateKey}`}
        onClick={(e) => e.stopPropagation()}
        className="self-end text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        予約する
      </Link>
    </div>
  );
}

function DayDetailPanel({
  dateKey,
  reservations,
}: {
  dateKey: string;
  reservations: CalendarReservation[];
}) {
  const dayReservations = reservations
    .filter((r) => r.dateKey === dateKey)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <h2 className="text-sm font-semibold">{formatDetailHeading(dateKey)}の会議室予約状況</h2>
      {dayReservations.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">この日の予約はありません</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {dayReservations.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded border border-black/5 bg-neutral-50 px-2 py-1 text-sm dark:border-white/5 dark:bg-neutral-800"
            >
              <div>
                <span className="font-mono text-xs text-neutral-500">
                  {timeFormatter.format(r.startAt)}–{timeFormatter.format(r.endAt)}
                </span>{" "}
                <span className="text-xs text-neutral-500">
                  {r.floorLabel} {r.roomName}
                </span>{" "}
                <span className="font-medium">{r.title}</span>
                <span className="text-neutral-500">（{r.bookerName}）</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDetailHeading(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}月${date.getDate()}日(${WEEKDAY_LABELS[date.getDay()]})`;
}

export function CalendarGrid({
  monthKey,
  reservations,
  currentMemberId,
}: {
  monthKey: string;
  /** その月に開始する組織内の全予約（会議室・フロアをまたいで横断的に持つ） */
  reservations: CalendarReservation[];
  currentMemberId: string;
}) {
  const gridDateKeys = getMonthGridDateKeys(monthKey);
  const todayKey = toDateKey(new Date());
  // 初期選択は「今月を表示中なら今日」「そうでなければ月初日」
  const [selectedDateKey, setSelectedDateKey] = useState(
    gridDateKeys.includes(todayKey) && todayKey.slice(0, 7) === monthKey
      ? todayKey
      : `${monthKey}-01`,
  );

  const reservationsByDate = new Map<string, CalendarReservation[]>();
  for (const r of reservations) {
    const list = reservationsByDate.get(r.dateKey) ?? [];
    list.push(r);
    reservationsByDate.set(r.dateKey, list);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-xs text-neutral-400">
            {label}
          </div>
        ))}
        {gridDateKeys.map((dateKey) => {
          const dayReservations = reservationsByDate.get(dateKey) ?? [];
          const myReservations = dayReservations.filter(
            (r) => r.createdByUserId === currentMemberId,
          );
          return (
            <DayCell
              key={dateKey}
              dateKey={dateKey}
              monthKey={monthKey}
              myReservations={myReservations}
              isSelected={dateKey === selectedDateKey}
              onSelect={() => setSelectedDateKey(dateKey)}
            />
          );
        })}
      </div>

      <DayDetailPanel dateKey={selectedDateKey} reservations={reservations} />
    </div>
  );
}

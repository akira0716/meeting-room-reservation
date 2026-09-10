"use client";

import type { CSSProperties } from "react";
import {
  computeBlockLayoutPx,
  computeTimelineRange,
  getHourMarks,
  getTimelineHeightPx,
} from "@/lib/timelineLayout";
import type { RoomReservation } from "@/lib/queries/getFloorMapData";

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
});

// 1時間あたりの高さ。デフォルト表示範囲（8:00〜20:00、12時間）でPX_PER_HOUR=48pxのとき
// 全体は576pxになり、VIEWPORT_MAX_PXで縦スクロールさせる（狭いポップオーバー内に
// 収めるため。何時間表示されても1時間あたりの高さは変えず、見やすさを優先する）。
const PX_PER_HOUR = 48;
const VIEWPORT_MAX_PX = 320;
// 時刻目盛りの列の幅。予約ブロックはこの右側に表示する
const HOUR_LABEL_WIDTH_PX = 40;
// 15分未満の短い予約でもクリックできる・視認できるよう、ブロックの高さの下限を設ける
const MIN_BLOCK_HEIGHT_PX = 16;

/**
 * 会議室1件・1日分の予約を、Outlookのようなタイムライン（縦軸＝時刻）で表示する。
 * 予約ブロックをクリックすると、編集可能な予約（canModifyがtrueを返すもの）に限り
 * onSelectReservationを呼び出す（実際の編集フォームの表示はRoomDetailPanel側が持つ）。
 *
 * 同じ会議室の予約同士は重ならない前提（サーバー側のisOverlappingチェックで保証される）
 * のため、重複時に横に並べるレイアウトは扱わない。
 */
export function RoomDayTimeline({
  dateKey,
  reservations,
  isToday,
  canModify,
  selectedReservationId,
  onSelectReservation,
}: {
  /** タイムラインの対象日（"YYYY-MM-DD"）。表示範囲の基準にする */
  dateKey: string;
  reservations: RoomReservation[];
  /** 現在時刻の線を表示するかどうか（今日を表示中のときのみ） */
  isToday: boolean;
  /** 予約ごとに編集可能かどうか（予約者本人または管理者のみtrue） */
  canModify: (reservation: RoomReservation) => boolean;
  /** 現在選択（編集）中の予約ID。該当ブロックをハイライトする */
  selectedReservationId: string | null;
  onSelectReservation: (reservationId: string) => void;
}) {
  const range = computeTimelineRange(
    dateKey,
    reservations.map((r) => ({ start: r.startAt, end: r.endAt })),
  );
  const totalHeightPx = getTimelineHeightPx(range, PX_PER_HOUR);
  const hourMarks = getHourMarks(range);

  const now = new Date();
  const showNowLine = isToday && now >= range.start && now <= range.end;
  const nowTopPx = showNowLine
    ? computeBlockLayoutPx(range, { start: now, end: now }, PX_PER_HOUR).topPx
    : 0;

  return (
    <div
      className="mt-1 overflow-y-auto rounded border border-black/10 dark:border-white/10"
      style={{ maxHeight: Math.min(totalHeightPx, VIEWPORT_MAX_PX) }}
    >
      <div className="relative" style={{ height: totalHeightPx }}>
        {hourMarks.map((mark) => {
          const { topPx } = computeBlockLayoutPx(range, { start: mark, end: mark }, PX_PER_HOUR);
          return (
            <div
              key={mark.getTime()}
              className="absolute inset-x-0 border-t border-black/5 dark:border-white/10"
              style={{ top: topPx }}
            >
              <span className="absolute left-0.5 -top-[9px] bg-white px-0.5 text-[10px] leading-none text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500">
                {timeFormatter.format(mark)}
              </span>
            </div>
          );
        })}

        {showNowLine && (
          <div
            className="absolute inset-x-0 z-10 border-t-2 border-rose-500"
            style={{ top: nowTopPx, left: HOUR_LABEL_WIDTH_PX }}
          />
        )}

        {reservations.map((reservation) => {
          const { topPx, heightPx } = computeBlockLayoutPx(
            range,
            { start: reservation.startAt, end: reservation.endAt },
            PX_PER_HOUR,
          );
          if (heightPx <= 0) return null;

          const editable = canModify(reservation);
          const isSelected = selectedReservationId === reservation.id;
          const label = `${timeFormatter.format(reservation.startAt)}–${timeFormatter.format(
            reservation.endAt,
          )} ${reservation.title}（${reservation.bookerName}）${
            reservation.note ? `\n${reservation.note}` : ""
          }`;

          const blockClassName = [
            "absolute overflow-hidden rounded border-l-4 px-1.5 py-0.5 text-left text-[11px] leading-tight",
            editable
              ? "border-l-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
              : "border-l-neutral-300 bg-neutral-100 dark:border-l-neutral-600 dark:bg-neutral-800",
            isSelected ? "ring-2 ring-indigo-500" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const style: CSSProperties = {
            top: topPx,
            height: Math.max(heightPx, MIN_BLOCK_HEIGHT_PX),
            left: HOUR_LABEL_WIDTH_PX + 2,
            right: 2,
          };

          if (!editable) {
            return (
              <div key={reservation.id} title={label} className={blockClassName} style={style}>
                <span className="block truncate font-medium">{reservation.title}</span>
              </div>
            );
          }

          return (
            <button
              key={reservation.id}
              type="button"
              title={label}
              onClick={() => onSelectReservation(reservation.id)}
              className={`${blockClassName} hover:bg-indigo-100 dark:hover:bg-indigo-500/20`}
              style={style}
            >
              <span className="block truncate font-medium">{reservation.title}</span>
              {heightPx >= 28 && (
                <span className="block truncate text-neutral-500 dark:text-neutral-400">
                  {reservation.bookerName}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

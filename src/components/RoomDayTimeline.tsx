"use client";

import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  clampDragRange,
  computeBlockLayoutPx,
  computeTimelineRange,
  finalizeDragRange,
  getHourMarks,
  getTimelineHeightPx,
  roundToNearestMinutes,
  DRAG_SNAP_MINUTES,
  type TimeRange,
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
 * 空いている時間帯はドラッグして選択でき、離す（pointerup）とonRangeSelectを呼び出す。
 * ドラッグ中は既存の予約とぶつからないようリアルタイムでクランプし（clampDragRange）、
 * ドラッグ量がほぼ無い＝クリックのみだった場合はデフォルトの30分を確保する
 * （finalizeDragRange、詳細はtimelineLayout.ts参照）。実際の予約確定（サーバーへの送信）は
 * 行わず、あくまで「予約フォームの開始・終了時刻を決める手段」として使う
 * （送信前に微調整できるよう、既存のdatetime-local欄はRoomDetailPanel側にそのまま残す）。
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
  onRangeSelect,
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
  /** 空き時間をドラッグして時間帯を選択したときに呼ばれる */
  onRangeSelect: (range: TimeRange) => void;
}) {
  const reservationRanges: TimeRange[] = reservations.map((r) => ({
    start: r.startAt,
    end: r.endAt,
  }));
  const range = computeTimelineRange(dateKey, reservationRanges);
  const totalHeightPx = getTimelineHeightPx(range, PX_PER_HOUR);
  const hourMarks = getHourMarks(range);

  const now = new Date();
  const showNowLine = isToday && now >= range.start && now <= range.end;
  const nowTopPx = showNowLine
    ? computeBlockLayoutPx(range, { start: now, end: now }, PX_PER_HOUR).topPx
    : 0;

  const contentRef = useRef<HTMLDivElement>(null);
  // ドラッグ中の選択範囲。anchor=ドラッグを開始した固定点、pointer=現在のポインタ位置。
  // どちらも既存予約とはまだクランプしていない生の時刻で持ち、表示直前にclampDragRangeを
  // 通す（pointerupの確定にはfinalizeDragRangeを使うため、ロジックを重複させないため）。
  const [drag, setDrag] = useState<{ anchor: Date; pointer: Date } | null>(null);

  function yToDate(clientY: number): Date {
    const el = contentRef.current;
    if (!el) return range.start;
    const rect = el.getBoundingClientRect();
    const y = Math.min(Math.max(clientY - rect.top, 0), totalHeightPx);
    const ms = range.start.getTime() + (y / PX_PER_HOUR) * 60 * 60 * 1000;
    return roundToNearestMinutes(new Date(ms), DRAG_SNAP_MINUTES);
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return; // 左クリックのみ（右クリック・中クリックでは開始しない）
    const anchor = yToDate(e.clientY);
    setDrag({ anchor, pointer: anchor });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return;
    setDrag({ anchor: drag.anchor, pointer: yToDate(e.clientY) });
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const finalRange = finalizeDragRange(drag.anchor, drag.pointer, reservationRanges);
    setDrag(null);
    if (finalRange.end.getTime() > finalRange.start.getTime()) {
      onRangeSelect(finalRange);
    }
  }

  const dragPreview = drag ? clampDragRange(drag.anchor, drag.pointer, reservationRanges) : null;
  const dragPreviewLayout = dragPreview
    ? computeBlockLayoutPx(range, dragPreview, PX_PER_HOUR)
    : null;

  return (
    <div
      // 見た目のスクロールバーを、フロア図画像のスクロールコンテナと同じno-scrollbar
      // ユーティリティ（globals.css）で非表示にする（スクロール自体は有効なまま）
      className="no-scrollbar mt-1 overflow-y-auto rounded border border-black/10 dark:border-white/10"
      style={{ maxHeight: Math.min(totalHeightPx, VIEWPORT_MAX_PX) }}
    >
      <div
        ref={contentRef}
        className="relative cursor-crosshair select-none"
        style={{ height: totalHeightPx }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
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

        {dragPreviewLayout && dragPreviewLayout.heightPx > 0 && (
          <div
            className="absolute z-20 overflow-hidden rounded border-2 border-dashed border-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] leading-tight text-emerald-800 dark:text-emerald-300"
            style={{
              top: dragPreviewLayout.topPx,
              height: Math.max(dragPreviewLayout.heightPx, MIN_BLOCK_HEIGHT_PX),
              left: HOUR_LABEL_WIDTH_PX + 2,
              right: 2,
            }}
          >
            {timeFormatter.format(dragPreview!.start)}–{timeFormatter.format(dragPreview!.end)}
          </div>
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

          // どちらの分岐も、pointerdownの時点でstopPropagationし、下（タイムライン本体）の
          // onPointerDownに伝播させない。既存の予約ブロックの上からドラッグ選択が
          // 始まってしまうのを防ぐため（clampDragRangeはanchorが予約の外にあることを
          // 前提にしているわけではないが、UI上は既存の予約の上から新規選択を開始
          // できないようにしておいた方が直感的）。
          if (!editable) {
            return (
              <div
                key={reservation.id}
                title={label}
                className={blockClassName}
                style={style}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <span className="block truncate font-medium">{reservation.title}</span>
              </div>
            );
          }

          return (
            <button
              key={reservation.id}
              type="button"
              title={label}
              onPointerDown={(e) => e.stopPropagation()}
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

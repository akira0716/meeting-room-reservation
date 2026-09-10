"use client";

import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  clampDragRange,
  clampMoveRange,
  clampResizeEnd,
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

// 1時間あたりの高さ。表示範囲は常に1日全体（24時間）で、PX_PER_HOUR=48pxのとき
// 全体は1152pxになるため、VIEWPORT_MAX_PXで縦スクロールさせる（ポップオーバー内に
// 収めるため）。
const PX_PER_HOUR = 48;
const VIEWPORT_MAX_PX = 360;
// 時刻目盛りの列の幅。予約ブロックはこの右側に表示する
const HOUR_LABEL_WIDTH_PX = 40;
// 15分未満の短い予約でもクリックできる・視認できるよう、ブロックの高さの下限を設ける
const MIN_BLOCK_HEIGHT_PX = 16;
// 既存予約ブロック下端のリサイズハンドルの高さ
const RESIZE_HANDLE_HEIGHT_PX = 6;

type MoveDrag = { kind: "move"; id: string; original: TimeRange; anchor: Date; pointer: Date };
type ResizeDrag = { kind: "resize"; id: string; original: TimeRange; pointer: Date };

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
 * 編集可能な既存予約は、ブロック本体をドラッグすると移動（長さは維持）、下端のハンドルを
 * ドラッグするとリサイズ（終了時刻のみ変更）できる。どちらも実際に動かした場合のみ
 * onReservationTimeChangeを呼び出し（サーバーへの反映はRoomDetailPanel側が行う）、
 * 動かさずにクリックしただけの場合は従来どおりonSelectReservationを呼ぶ（編集フォームを開く）。
 * 上端のリサイズ（開始時刻の変更）は、会議室のリサイズハンドルが右下角のみなのと同様、
 * 今回はスコープを絞って対応していない。
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
  onReservationTimeChange,
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
  /** 既存予約をドラッグで移動・リサイズし、実際に時間が変わったときに呼ばれる */
  onReservationTimeChange: (reservationId: string, range: TimeRange) => void;
}) {
  const range = computeTimelineRange(dateKey);
  const totalHeightPx = getTimelineHeightPx(range, PX_PER_HOUR);
  const hourMarks = getHourMarks(range);

  const now = new Date();
  const showNowLine = isToday && now >= range.start && now <= range.end;
  const nowTopPx = showNowLine
    ? computeBlockLayoutPx(range, { start: now, end: now }, PX_PER_HOUR).topPx
    : 0;

  const contentRef = useRef<HTMLDivElement>(null);
  // 空き時間の新規選択ドラッグ。anchor=ドラッグを開始した固定点、pointer=現在のポインタ位置。
  // どちらも既存予約とはまだクランプしていない生の時刻で持ち、表示直前にclampDragRangeを
  // 通す（pointerupの確定にはfinalizeDragRangeを使うため、ロジックを重複させないため）。
  const [drag, setDrag] = useState<{ anchor: Date; pointer: Date } | null>(null);
  // 既存予約の移動・リサイズドラッグ。新規選択（drag）とは排他（同時に1つまで）
  const [reservationDrag, setReservationDrag] = useState<MoveDrag | ResizeDrag | null>(null);

  function yToDate(clientY: number): Date {
    const el = contentRef.current;
    if (!el) return range.start;
    const rect = el.getBoundingClientRect();
    const y = Math.min(Math.max(clientY - rect.top, 0), totalHeightPx);
    const ms = range.start.getTime() + (y / PX_PER_HOUR) * 60 * 60 * 1000;
    return roundToNearestMinutes(new Date(ms), DRAG_SNAP_MINUTES);
  }

  /** reservationsから、指定したID以外の{start, end}の配列を返す（クランプ計算で自分自身を除外するため） */
  function otherRanges(excludeId: string): TimeRange[] {
    return reservations
      .filter((r) => r.id !== excludeId)
      .map((r) => ({ start: r.startAt, end: r.endAt }));
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
    const reservationRanges = reservations.map((r) => ({ start: r.startAt, end: r.endAt }));
    const finalRange = finalizeDragRange(drag.anchor, drag.pointer, reservationRanges);
    setDrag(null);
    if (finalRange.end.getTime() > finalRange.start.getTime()) {
      onRangeSelect(finalRange);
    }
  }

  function handleReservationPointerDown(
    e: ReactPointerEvent<HTMLDivElement>,
    reservation: RoomReservation,
  ) {
    if (e.button !== 0) return;
    e.stopPropagation(); // タイムライン本体（新規選択）のドラッグ開始を防ぐ
    const anchor = yToDate(e.clientY);
    setReservationDrag({
      kind: "move",
      id: reservation.id,
      original: { start: reservation.startAt, end: reservation.endAt },
      anchor,
      pointer: anchor,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleResizeHandlePointerDown(
    e: ReactPointerEvent<HTMLDivElement>,
    reservation: RoomReservation,
  ) {
    if (e.button !== 0) return;
    e.stopPropagation();
    setReservationDrag({
      kind: "resize",
      id: reservation.id,
      original: { start: reservation.startAt, end: reservation.endAt },
      pointer: reservation.endAt,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleReservationPointerMove(e: ReactPointerEvent<HTMLElement>) {
    // リサイズハンドルはブロック本体の内側にあり、どちらも同じハンドラを付けているため、
    // 何もしないとイベントがハンドルからブロック本体へバブリングしてハンドラが二重に
    // 呼ばれてしまう（pointer captureは対象の要素を固定するだけで、バブリング自体は
    // 通常どおり起こる）。ここで止めて二重発火を防ぐ
    e.stopPropagation();
    if (!reservationDrag) return;
    const pointer = yToDate(e.clientY);
    setReservationDrag({ ...reservationDrag, pointer });
  }

  function endReservationDrag(e: ReactPointerEvent<HTMLElement>) {
    // handleReservationPointerMoveと同じ理由でバブリングを止める（二重にサーバーへ
    // 送信してしまうのを防ぐ）
    e.stopPropagation();
    if (!reservationDrag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const { id, original } = reservationDrag;
    const others = otherRanges(id);

    if (reservationDrag.kind === "move") {
      const hasMoved = reservationDrag.pointer.getTime() !== reservationDrag.anchor.getTime();
      setReservationDrag(null);
      if (!hasMoved) {
        onSelectReservation(id); // 実質クリックのみ：従来どおり編集フォームを開く
        return;
      }
      const deltaMs = reservationDrag.pointer.getTime() - reservationDrag.anchor.getTime();
      const finalRange = clampMoveRange(original, deltaMs, others, range);
      if (finalRange.start.getTime() !== original.start.getTime()) {
        onReservationTimeChange(id, finalRange);
      }
    } else {
      setReservationDrag(null);
      const newEnd = clampResizeEnd(original.start, reservationDrag.pointer, others, range.end);
      if (newEnd.getTime() !== original.end.getTime() && newEnd.getTime() > original.start.getTime()) {
        onReservationTimeChange(id, { start: original.start, end: newEnd });
      }
    }
  }

  const dragPreview = drag ? clampDragRange(drag.anchor, drag.pointer, reservations.map((r) => ({ start: r.startAt, end: r.endAt }))) : null;
  const dragPreviewLayout = dragPreview
    ? computeBlockLayoutPx(range, dragPreview, PX_PER_HOUR)
    : null;

  // 移動・リサイズ中の予約のプレビュー時間帯（表示用）。確定前のクランプ結果をそのまま見せる
  let reservationDragPreview: { id: string; range: TimeRange } | null = null;
  if (reservationDrag) {
    const others = otherRanges(reservationDrag.id);
    if (reservationDrag.kind === "move") {
      const deltaMs = reservationDrag.pointer.getTime() - reservationDrag.anchor.getTime();
      reservationDragPreview = {
        id: reservationDrag.id,
        range: clampMoveRange(reservationDrag.original, deltaMs, others, range),
      };
    } else {
      reservationDragPreview = {
        id: reservationDrag.id,
        range: {
          start: reservationDrag.original.start,
          end: clampResizeEnd(reservationDrag.original.start, reservationDrag.pointer, others, range.end),
        },
      };
    }
  }

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
          // 移動・リサイズ中の予約は、通常のブロックの代わりに専用のプレビューを描画する
          const isBeingDragged = reservationDragPreview?.id === reservation.id;
          const displayRange = isBeingDragged
            ? reservationDragPreview!.range
            : { start: reservation.startAt, end: reservation.endAt };
          const { topPx, heightPx } = computeBlockLayoutPx(range, displayRange, PX_PER_HOUR);
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
            isBeingDragged ? "opacity-80 shadow-md ring-2 ring-indigo-500" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const style: CSSProperties = {
            top: topPx,
            height: Math.max(heightPx, MIN_BLOCK_HEIGHT_PX),
            left: HOUR_LABEL_WIDTH_PX + 2,
            right: 2,
          };

          const displayLabel = isBeingDragged
            ? `${timeFormatter.format(displayRange.start)}–${timeFormatter.format(displayRange.end)} ${reservation.title}`
            : label;

          // 編集不可のブロックは、pointerdownの時点でstopPropagationし、下（タイムライン
          // 本体）のonPointerDownに伝播させない。既存の予約ブロックの上から新規選択の
          // ドラッグが始まってしまうのを防ぐため。
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

          // ドラッグでの移動・リサイズは独自のpointerイベントで実装しており、ネイティブの
          // <button>のクリック挙動には乗らない（クリックかドラッグかはendReservationDrag側で
          // 移動量から判定する）ため、リサイズハンドル（内側の要素）を持てるよう<div>にし、
          // role/tabIndexとキーボード操作（Enter/Space）で最低限のアクセシビリティを保つ。
          return (
            <div
              key={reservation.id}
              role="button"
              tabIndex={0}
              title={displayLabel}
              onPointerDown={(e) => handleReservationPointerDown(e, reservation)}
              onPointerMove={handleReservationPointerMove}
              onPointerUp={endReservationDrag}
              onPointerCancel={endReservationDrag}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectReservation(reservation.id);
                }
              }}
              className={`${blockClassName} cursor-grab active:cursor-grabbing hover:bg-indigo-100 dark:hover:bg-indigo-500/20`}
              style={style}
            >
              <span className="block truncate font-medium">{reservation.title}</span>
              {heightPx >= 28 && (
                <span className="block truncate text-neutral-500 dark:text-neutral-400">
                  {reservation.bookerName}
                </span>
              )}
              {/* 下端のリサイズハンドル。ドラッグすると終了時刻のみ変更する（開始時刻は固定） */}
              <div
                onPointerDown={(e) => handleResizeHandlePointerDown(e, reservation)}
                onPointerMove={handleReservationPointerMove}
                onPointerUp={endReservationDrag}
                onPointerCancel={endReservationDrag}
                className="absolute inset-x-0 bottom-0 cursor-ns-resize"
                style={{ height: RESIZE_HANDLE_HEIGHT_PX }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

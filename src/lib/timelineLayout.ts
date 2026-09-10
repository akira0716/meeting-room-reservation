/**
 * 会議室の「1日分の予約」をOutlookのようなタイムライン（縦軸＝時刻）で表示するための
 * 純粋関数群。DBやReactに依存しないため単体テストしやすい（reservationOverlap.tsと同じ方針）。
 *
 * 前提：同じ会議室の予約同士は重ならない（サーバー側のisOverlappingチェックで保証される）ため、
 * このモジュールは「横に並べて重複を避ける」ようなレイアウト計算は行わない。
 */
import { parseDateKey } from "./dateKey";

export type TimeRange = { start: Date; end: Date };

const HOUR_MS = 60 * 60 * 1000;

/**
 * タイムラインの表示範囲（開始・終了のDate）を決める。
 * 常にdateKeyが指す日の0:00〜24:00（1日全体）を返す。対象日の枠を超える予約
 * （getFloorMapDataは日をまたぐ予約もその日にヒットさせる）があっても、その日の枠を
 * 超えて表示すると「今何日を見ているか」が分かりにくくなるため、あえて対象日の
 * 0:00〜翌0:00でクランプする（＝日をまたぐ部分はこのタイムライン上では見えない。
 * computeBlockLayoutPxが範囲外をクランプするため、はみ出た予約も表示上は
 * この範囲内で切り詰められる）。
 */
export function computeTimelineRange(dateKey: string): TimeRange {
  const start = parseDateKey(dateKey);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** タイムライン表示範囲の全体の高さ（px）。pxPerHourは1時間あたりの高さ */
export function getTimelineHeightPx(timelineRange: TimeRange, pxPerHour: number): number {
  const hours = (timelineRange.end.getTime() - timelineRange.start.getTime()) / HOUR_MS;
  return Math.max(0, hours) * pxPerHour;
}

/**
 * タイムライン上でのブロック（予約・時刻目盛りなど）の位置・高さをpx単位で返す。
 * 表示範囲からはみ出す部分はクランプする（heightPxが0の場合は表示範囲に全く
 * かからないことを意味し、呼び出し側は描画をスキップしてよい）。
 */
export function computeBlockLayoutPx(
  timelineRange: TimeRange,
  block: TimeRange,
  pxPerHour: number,
): { topPx: number; heightPx: number } {
  const rangeStartMs = timelineRange.start.getTime();
  const clampedStartMs = Math.max(block.start.getTime(), rangeStartMs);
  const clampedEndMs = Math.min(block.end.getTime(), timelineRange.end.getTime());

  const topPx = ((clampedStartMs - rangeStartMs) / HOUR_MS) * pxPerHour;
  const heightPx = (Math.max(0, clampedEndMs - clampedStartMs) / HOUR_MS) * pxPerHour;
  return { topPx, heightPx };
}

/** タイムラインの目盛りに使う、表示範囲内に収まる各正時（◯:00）のDate配列を返す */
export function getHourMarks(timelineRange: TimeRange): Date[] {
  const cursor = new Date(timelineRange.start);
  cursor.setMinutes(0, 0, 0);
  if (cursor < timelineRange.start) cursor.setHours(cursor.getHours() + 1);

  const marks: Date[] = [];
  while (cursor <= timelineRange.end) {
    marks.push(new Date(cursor));
    cursor.setHours(cursor.getHours() + 1);
  }
  return marks;
}

/** タイムライン上でのドラッグ操作を、この分単位のグリッドにスナップさせる */
export const DRAG_SNAP_MINUTES = 15;

/** ドラッグ量が実質クリックのみ（グリッド1マス未満）だった場合に確保する、デフォルトの予約時間（分） */
export const DEFAULT_DRAG_DURATION_MINUTES = 30;

/** 指定した分単位の最も近いグリッド線に時刻をスナップさせる */
export function roundToNearestMinutes(date: Date, minutes: number): Date {
  const ms = minutes * 60_000;
  return new Date(Math.round(date.getTime() / ms) * ms);
}

/**
 * ドラッグで選択中の時間帯（anchor＝ドラッグを開始した固定点、pointer＝現在のポインタ位置に
 * 対応する時刻）を、既存の予約とぶつからないようクランプして返す。
 * 同じ会議室の予約同士は重ならない前提（timelineLayout.ts冒頭の前提を参照）なので、
 * 「anchorより未来にある予約の開始」と「anchorより過去にある予約の終了」でそれぞれ
 * 選択範囲の端を止めればよい（予約は互いに重ならないため、複数の予約を跨いで
 * 選択しようとしても最初にぶつかった予約の端で止まる）。
 */
export function clampDragRange(anchor: Date, pointer: Date, reservations: TimeRange[]): TimeRange {
  let start = anchor < pointer ? anchor : pointer;
  let end = anchor < pointer ? pointer : anchor;

  for (const r of reservations) {
    if (anchor >= r.start && anchor < r.end) {
      // anchor自体が既存予約の中にある（本来はUI側でドラッグ開始を防ぐ想定だが、念のため）
      start = new Date(Math.max(start.getTime(), r.start.getTime()));
      end = new Date(Math.min(end.getTime(), r.end.getTime()));
      continue;
    }
    if (r.start >= anchor && r.start < end) {
      end = new Date(Math.min(end.getTime(), r.start.getTime()));
    }
    if (r.end <= anchor && r.end > start) {
      start = new Date(Math.max(start.getTime(), r.end.getTime()));
    }
  }
  return { start, end };
}

/**
 * ドラッグ操作の確定値（pointerup時）を計算する。
 * clampDragRangeでクランプした結果、選択時間がグリッド1マス（DRAG_SNAP_MINUTES）未満
 * （＝実質ドラッグしていない、クリックのみ）だった場合は、anchorからデフォルトの長さ
 * （DEFAULT_DRAG_DURATION_MINUTES）を確保する。ただしその場合も、既存の予約とは
 * 重ならないよう改めてクランプする（デフォルトの長さぶん伸ばした先に別の予約があれば、
 * そこで止まる＝予約可能な残り時間しか選択されない）。
 */
export function finalizeDragRange(
  anchor: Date,
  pointer: Date,
  reservations: TimeRange[],
): TimeRange {
  const clamped = clampDragRange(anchor, pointer, reservations);
  const durationMs = clamped.end.getTime() - clamped.start.getTime();
  if (durationMs >= DRAG_SNAP_MINUTES * 60_000) {
    return clamped;
  }
  const defaultEnd = new Date(anchor.getTime() + DEFAULT_DRAG_DURATION_MINUTES * 60_000);
  return clampDragRange(anchor, defaultEnd, reservations);
}

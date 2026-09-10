/**
 * 会議室の「1日分の予約」をOutlookのようなタイムライン（縦軸＝時刻）で表示するための
 * 純粋関数群。DBやReactに依存しないため単体テストしやすい（reservationOverlap.tsと同じ方針）。
 *
 * 前提：同じ会議室の予約同士は重ならない（サーバー側のisOverlappingチェックで保証される）ため、
 * このモジュールは「横に並べて重複を避ける」ようなレイアウト計算は行わない。
 */
import { parseDateKey } from "./dateKey";

export type TimeRange = { start: Date; end: Date };

/** タイムラインのデフォルト表示範囲（8:00〜20:00）。営業時間の目安として決め打ちしている。
 *  これより早く始まる／遅く終わる予約がある場合は、computeTimelineRangeが自動的に広げる。 */
export const DEFAULT_TIMELINE_START_HOUR = 8;
export const DEFAULT_TIMELINE_END_HOUR = 20;

const HOUR_MS = 60 * 60 * 1000;

/**
 * タイムラインの表示範囲（開始・終了のDate）を決める。
 * 基本はdateKeyが指す日の8:00〜20:00だが、それより早く始まる／遅く終わる予約があれば、
 * 予約が見切れないよう表示範囲を広げる。ただし対象日の枠（0:00〜翌0:00）は超えない
 * （getFloorMapDataは日をまたぐ予約もその日にヒットさせるため、日をまたぐ部分は
 * このタイムライン上では見えなくなるが、対象日の枠を超えて表示すると
 * 「今何日を見ているか」が分かりにくくなるためあえてクランプする）。
 */
export function computeTimelineRange(dateKey: string, reservations: TimeRange[]): TimeRange {
  const dayStart = parseDateKey(dateKey);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  let start = new Date(dayStart);
  start.setHours(DEFAULT_TIMELINE_START_HOUR, 0, 0, 0);
  let end = new Date(dayStart);
  end.setHours(DEFAULT_TIMELINE_END_HOUR, 0, 0, 0);

  for (const r of reservations) {
    if (r.start < start) start = r.start < dayStart ? new Date(dayStart) : r.start;
    if (r.end > end) end = r.end > dayEnd ? new Date(dayEnd) : r.end;
  }
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

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

/**
 * 既存予約をドラッグで移動させるときの、移動後の時間帯を計算する（長さは常に維持する）。
 * deltaMsは「ドラッグ開始位置から現在位置までの移動量」。他の予約（引数の
 * reservationsには移動対象自身を含めないこと）や対象日の範囲（dayRange）とぶつからないよう、
 * 実際の移動量をクランプする。
 */
export function clampMoveRange(
  original: TimeRange,
  deltaMs: number,
  reservations: TimeRange[],
  dayRange: TimeRange,
): TimeRange {
  const durationMs = original.end.getTime() - original.start.getTime();
  const minStartMs = dayRange.start.getTime();
  const maxStartMs = dayRange.end.getTime() - durationMs;

  let startMs = original.start.getTime() + deltaMs;
  startMs = Math.min(Math.max(startMs, minStartMs), maxStartMs);

  for (const r of reservations) {
    const endMs = startMs + durationMs;
    if (startMs < r.end.getTime() && endMs > r.start.getTime()) {
      // 移動方向（未来へ／過去へ）に応じて、ぶつかった予約の手前で止める
      startMs =
        deltaMs >= 0
          ? Math.min(startMs, r.start.getTime() - durationMs)
          : Math.max(startMs, r.end.getTime());
    }
  }
  // 他の予約に押し戻された結果、対象日の範囲を超えてしまう場合に備えて再度クランプする
  startMs = Math.min(Math.max(startMs, minStartMs), maxStartMs);

  return { start: new Date(startMs), end: new Date(startMs + durationMs) };
}

/**
 * 既存予約の下端（終了時刻）をドラッグでリサイズするときの、リサイズ後の終了時刻を計算する。
 * 開始時刻（start）は固定。最小長（DRAG_SNAP_MINUTES）を下回らないようにしつつ、
 * 他の予約（引数のreservationsにはリサイズ対象自身を含めないこと）や対象日の終端
 * （dayEnd）とはぶつからないようクランプする。ただし、隣接する予約との間隔が
 * 最小長より狭い場合は、最小長を確保できず短い予約になることもある
 * （それでも重ならないことを優先する）。
 */
export function clampResizeEnd(
  start: Date,
  proposedEnd: Date,
  reservations: TimeRange[],
  dayEnd: Date,
): Date {
  const minEndMs = start.getTime() + DRAG_SNAP_MINUTES * 60_000;
  let endMs = Math.max(proposedEnd.getTime(), minEndMs);
  endMs = Math.min(endMs, dayEnd.getTime());

  for (const r of reservations) {
    if (r.start.getTime() >= start.getTime() && r.start.getTime() < endMs) {
      endMs = Math.min(endMs, r.start.getTime());
    }
  }
  // 開始時刻より前にはならないようにする（隣接する予約が近すぎる場合の保険）
  return new Date(Math.max(endMs, start.getTime()));
}

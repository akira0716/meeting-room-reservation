/**
 * フロアマップの「表示中の日付」を、URLの検索パラメータ（?date=）や
 * FloorMapDataでの受け渡しに使う"YYYY-MM-DD"形式（ローカル日付）で統一的に
 * 扱うためのユーティリティ。UTC変換は行わない（サーバーのローカル時刻を
 * そのままその組織の営業日とみなす、既存のgetFloorMapData.tsの前提を踏襲）。
 */

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" をローカル時刻の0時のDateに変換する。不正な文字列ならInvalid Dateを返す */
export function parseDateKey(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** 「9月6日(土)」のような表示用ラベルに変換する */
export function formatDateLabel(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}月${date.getDate()}日(${WEEKDAY_LABELS[date.getDay()]})`;
}

/** `<input type="datetime-local">` のvalue文字列に変換する */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

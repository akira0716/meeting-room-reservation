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

/** カレンダー画面の「表示中の月」を、URLの検索パラメータ（?month=）で扱う"YYYY-MM"形式に変換する */
export function toMonthKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** "YYYY-MM" をその月の1日・ローカル0時のDateに変換する。不正な文字列ならInvalid Dateを返す */
export function parseMonthKey(value: string): Date {
  const [y, m] = value.split("-").map(Number);
  if (!y || !m) return new Date(NaN);
  return new Date(y, m - 1, 1);
}

export function addMonthsToMonthKey(monthKey: string, months: number): string {
  const date = parseMonthKey(monthKey);
  date.setMonth(date.getMonth() + months);
  return toMonthKey(date);
}

/** 「2026年9月」のような表示用ラベルに変換する */
export function formatMonthLabel(monthKey: string): string {
  const date = parseMonthKey(monthKey);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

/**
 * カレンダーの月表示グリッド用に、その月を含む週（日曜始まり）をすべて埋める
 * 日付キーの配列を返す（前月末・翌月頭の日もパディングとして含む）。
 */
export function getMonthGridDateKeys(monthKey: string): string[] {
  const firstOfMonth = parseMonthKey(monthKey);
  const startWeekday = firstOfMonth.getDay(); // 0=日曜
  const daysInMonth = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const cursor = new Date(firstOfMonth);
  cursor.setDate(cursor.getDate() - startWeekday);

  const dateKeys: string[] = [];
  for (let i = 0; i < totalCells; i++) {
    dateKeys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dateKeys;
}

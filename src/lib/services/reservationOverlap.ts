/**
 * 2つの時間帯が重なっているかどうかを判定する。
 * DBやフレームワークに依存しない純粋関数として実装する（テストしやすさを優先）。
 *
 * 例：
 *   10:00-11:00 と 10:30-11:30 → 重複あり(true)
 *   10:00-11:00 と 11:00-12:00 → 重複なし(false)（端点が接するだけは重複扱いしない）
 */
export type TimeRange = {
  start: Date;
  end: Date;
};

export function isOverlapping(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

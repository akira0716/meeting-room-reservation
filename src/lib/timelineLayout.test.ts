import { describe, it, expect } from "vitest";
import {
  computeTimelineRange,
  computeBlockLayoutPx,
  getTimelineHeightPx,
  getHourMarks,
  roundToNearestMinutes,
  clampDragRange,
  finalizeDragRange,
  clampMoveRange,
  clampResizeEnd,
} from "./timelineLayout";

describe("computeTimelineRange", () => {
  it("常にその日の0:00〜24:00（翌0:00）を返す", () => {
    const range = computeTimelineRange("2026-09-10");
    expect(range.start).toEqual(new Date("2026-09-10T00:00"));
    expect(range.end).toEqual(new Date("2026-09-11T00:00"));
  });

  it("日付が変わればその日の0:00〜翌0:00を返す", () => {
    const range = computeTimelineRange("2026-12-31");
    expect(range.start).toEqual(new Date("2026-12-31T00:00"));
    expect(range.end).toEqual(new Date("2027-01-01T00:00"));
  });
});

describe("getTimelineHeightPx", () => {
  it("範囲の時間数×pxPerHourを返す", () => {
    const range = { start: new Date("2026-09-10T08:00"), end: new Date("2026-09-10T20:00") };
    expect(getTimelineHeightPx(range, 48)).toBe(12 * 48);
  });

  it("端数の時間も正しく計算する", () => {
    const range = { start: new Date("2026-09-10T07:45"), end: new Date("2026-09-10T08:15") };
    expect(getTimelineHeightPx(range, 48)).toBe(0.5 * 48);
  });
});

describe("computeBlockLayoutPx", () => {
  const range = { start: new Date("2026-09-10T08:00"), end: new Date("2026-09-10T20:00") };
  const pxPerHour = 48;

  it("範囲内に完全に収まるブロックは、経過時間どおりのtop/heightになる", () => {
    const result = computeBlockLayoutPx(
      range,
      { start: new Date("2026-09-10T10:00"), end: new Date("2026-09-10T11:00") },
      pxPerHour,
    );
    expect(result).toEqual({ topPx: 2 * 48, heightPx: 1 * 48 });
  });

  it("範囲の開始よりも前から始まるブロックは、範囲の開始でクランプする", () => {
    const result = computeBlockLayoutPx(
      range,
      { start: new Date("2026-09-10T07:00"), end: new Date("2026-09-10T09:00") },
      pxPerHour,
    );
    expect(result).toEqual({ topPx: 0, heightPx: 1 * 48 });
  });

  it("範囲の終了よりも後まで続くブロックは、範囲の終了でクランプする", () => {
    const result = computeBlockLayoutPx(
      range,
      { start: new Date("2026-09-10T19:00"), end: new Date("2026-09-10T21:00") },
      pxPerHour,
    );
    expect(result).toEqual({ topPx: 11 * 48, heightPx: 1 * 48 });
  });

  it("範囲に全くかからないブロックはheightPxが0になる", () => {
    const result = computeBlockLayoutPx(
      range,
      { start: new Date("2026-09-10T21:00"), end: new Date("2026-09-10T22:00") },
      pxPerHour,
    );
    expect(result.heightPx).toBe(0);
  });
});

describe("getHourMarks", () => {
  it("範囲内の各正時を返す（両端含む）", () => {
    const range = { start: new Date("2026-09-10T08:00"), end: new Date("2026-09-10T11:00") };
    expect(getHourMarks(range)).toEqual([
      new Date("2026-09-10T08:00"),
      new Date("2026-09-10T09:00"),
      new Date("2026-09-10T10:00"),
      new Date("2026-09-10T11:00"),
    ]);
  });

  it("端数から始まる範囲では、最初の正時から始める", () => {
    const range = { start: new Date("2026-09-10T07:45"), end: new Date("2026-09-10T09:30") };
    expect(getHourMarks(range)).toEqual([
      new Date("2026-09-10T08:00"),
      new Date("2026-09-10T09:00"),
    ]);
  });
});

describe("roundToNearestMinutes", () => {
  it("最も近い15分単位に丸める（切り上げ）", () => {
    expect(roundToNearestMinutes(new Date("2026-09-10T10:08"), 15)).toEqual(
      new Date("2026-09-10T10:15"),
    );
  });

  it("最も近い15分単位に丸める（切り下げ）", () => {
    expect(roundToNearestMinutes(new Date("2026-09-10T10:07"), 15)).toEqual(
      new Date("2026-09-10T10:00"),
    );
  });

  it("すでにグリッド上にある時刻はそのまま返す", () => {
    expect(roundToNearestMinutes(new Date("2026-09-10T10:30"), 15)).toEqual(
      new Date("2026-09-10T10:30"),
    );
  });
});

describe("clampDragRange", () => {
  it("既存の予約が無ければanchor・pointerをそのまま開始・終了として返す", () => {
    const result = clampDragRange(
      new Date("2026-09-10T10:00"),
      new Date("2026-09-10T11:00"),
      [],
    );
    expect(result).toEqual({ start: new Date("2026-09-10T10:00"), end: new Date("2026-09-10T11:00") });
  });

  it("pointerがanchorより前でも開始・終了を正しい順序にする", () => {
    const result = clampDragRange(
      new Date("2026-09-10T11:00"),
      new Date("2026-09-10T10:00"),
      [],
    );
    expect(result).toEqual({ start: new Date("2026-09-10T10:00"), end: new Date("2026-09-10T11:00") });
  });

  it("未来方向（pointerが後ろ）に既存予約があれば、その開始でクランプする", () => {
    const result = clampDragRange(
      new Date("2026-09-10T10:00"),
      new Date("2026-09-10T13:00"),
      [{ start: new Date("2026-09-10T11:00"), end: new Date("2026-09-10T12:00") }],
    );
    expect(result).toEqual({ start: new Date("2026-09-10T10:00"), end: new Date("2026-09-10T11:00") });
  });

  it("過去方向（pointerが前）に既存予約があれば、その終了でクランプする", () => {
    const result = clampDragRange(
      new Date("2026-09-10T13:00"),
      new Date("2026-09-10T10:00"),
      [{ start: new Date("2026-09-10T11:00"), end: new Date("2026-09-10T12:00") }],
    );
    expect(result).toEqual({ start: new Date("2026-09-10T12:00"), end: new Date("2026-09-10T13:00") });
  });

  it("選択範囲にかからない予約は無視する", () => {
    const result = clampDragRange(
      new Date("2026-09-10T10:00"),
      new Date("2026-09-10T11:00"),
      [{ start: new Date("2026-09-10T14:00"), end: new Date("2026-09-10T15:00") }],
    );
    expect(result).toEqual({ start: new Date("2026-09-10T10:00"), end: new Date("2026-09-10T11:00") });
  });
});

describe("finalizeDragRange", () => {
  it("グリッド1マス以上の選択はそのまま確定する", () => {
    const result = finalizeDragRange(
      new Date("2026-09-10T10:00"),
      new Date("2026-09-10T10:30"),
      [],
    );
    expect(result).toEqual({ start: new Date("2026-09-10T10:00"), end: new Date("2026-09-10T10:30") });
  });

  it("ドラッグ量がグリッド1マス未満（実質クリックのみ）なら、デフォルトの30分を確保する", () => {
    const result = finalizeDragRange(
      new Date("2026-09-10T10:00"),
      new Date("2026-09-10T10:05"),
      [],
    );
    expect(result).toEqual({ start: new Date("2026-09-10T10:00"), end: new Date("2026-09-10T10:30") });
  });

  it("デフォルトの30分を確保する先に既存予約があれば、その手前までしか確保しない", () => {
    const result = finalizeDragRange(
      new Date("2026-09-10T10:00"),
      new Date("2026-09-10T10:00"),
      [{ start: new Date("2026-09-10T10:15"), end: new Date("2026-09-10T11:00") }],
    );
    expect(result).toEqual({ start: new Date("2026-09-10T10:00"), end: new Date("2026-09-10T10:15") });
  });
});

describe("clampMoveRange", () => {
  const dayRange = { start: new Date("2026-09-10T00:00"), end: new Date("2026-09-11T00:00") };
  const original = { start: new Date("2026-09-10T10:00"), end: new Date("2026-09-10T11:00") };

  it("ぶつかる予約が無ければ、長さを保ったままdeltaMsぶん移動する", () => {
    const result = clampMoveRange(original, 60 * 60_000, [], dayRange);
    expect(result).toEqual({ start: new Date("2026-09-10T11:00"), end: new Date("2026-09-10T12:00") });
  });

  it("未来方向への移動が既存予約にぶつかる場合、その手前で止める（長さは維持）", () => {
    const result = clampMoveRange(
      original,
      90 * 60_000, // 11:30に移動しようとする
      [{ start: new Date("2026-09-10T12:00"), end: new Date("2026-09-10T13:00") }],
      dayRange,
    );
    expect(result).toEqual({ start: new Date("2026-09-10T11:00"), end: new Date("2026-09-10T12:00") });
  });

  it("過去方向への移動が既存予約にぶつかる場合、その手前で止める（長さは維持）", () => {
    const result = clampMoveRange(
      original,
      -90 * 60_000, // 8:30に移動しようとする
      [{ start: new Date("2026-09-10T08:00"), end: new Date("2026-09-10T09:00") }],
      dayRange,
    );
    expect(result).toEqual({ start: new Date("2026-09-10T09:00"), end: new Date("2026-09-10T10:00") });
  });

  it("対象日の範囲を超えて移動しようとした場合、範囲内でクランプする", () => {
    const result = clampMoveRange(original, -20 * 60 * 60_000, [], dayRange);
    expect(result).toEqual({ start: new Date("2026-09-10T00:00"), end: new Date("2026-09-10T01:00") });
  });
});

describe("clampResizeEnd", () => {
  const dayEnd = new Date("2026-09-11T00:00");
  const start = new Date("2026-09-10T10:00");

  it("ぶつかる予約が無ければ、指定した終了時刻をそのまま返す", () => {
    const result = clampResizeEnd(start, new Date("2026-09-10T11:30"), [], dayEnd);
    expect(result).toEqual(new Date("2026-09-10T11:30"));
  });

  it("最小長（15分）を下回る終了時刻は、最小長まで確保する", () => {
    const result = clampResizeEnd(start, new Date("2026-09-10T10:05"), [], dayEnd);
    expect(result).toEqual(new Date("2026-09-10T10:15"));
  });

  it("次の予約の開始時刻を超えないようクランプする", () => {
    const result = clampResizeEnd(
      start,
      new Date("2026-09-10T12:00"),
      [{ start: new Date("2026-09-10T11:00"), end: new Date("2026-09-10T13:00") }],
      dayEnd,
    );
    expect(result).toEqual(new Date("2026-09-10T11:00"));
  });

  it("対象日の終端を超えないようクランプする", () => {
    const result = clampResizeEnd(start, new Date("2026-09-12T00:00"), [], dayEnd);
    expect(result).toEqual(dayEnd);
  });
});

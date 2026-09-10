import { describe, it, expect } from "vitest";
import {
  computeTimelineRange,
  computeBlockLayoutPx,
  getTimelineHeightPx,
  getHourMarks,
  roundToNearestMinutes,
  clampDragRange,
  finalizeDragRange,
} from "./timelineLayout";

describe("computeTimelineRange", () => {
  it("予約が無ければデフォルトの8:00〜20:00を返す", () => {
    const range = computeTimelineRange("2026-09-10", []);
    expect(range.start).toEqual(new Date("2026-09-10T08:00"));
    expect(range.end).toEqual(new Date("2026-09-10T20:00"));
  });

  it("予約がデフォルト範囲に収まっていれば範囲を広げない", () => {
    const range = computeTimelineRange("2026-09-10", [
      { start: new Date("2026-09-10T10:00"), end: new Date("2026-09-10T11:00") },
    ]);
    expect(range.start).toEqual(new Date("2026-09-10T08:00"));
    expect(range.end).toEqual(new Date("2026-09-10T20:00"));
  });

  it("デフォルトより早く始まる予約があれば開始を早める", () => {
    const range = computeTimelineRange("2026-09-10", [
      { start: new Date("2026-09-10T07:30"), end: new Date("2026-09-10T08:30") },
    ]);
    expect(range.start).toEqual(new Date("2026-09-10T07:30"));
    expect(range.end).toEqual(new Date("2026-09-10T20:00"));
  });

  it("デフォルトより遅く終わる予約があれば終了を遅らせる", () => {
    const range = computeTimelineRange("2026-09-10", [
      { start: new Date("2026-09-10T19:00"), end: new Date("2026-09-10T21:15") },
    ]);
    expect(range.start).toEqual(new Date("2026-09-10T08:00"));
    expect(range.end).toEqual(new Date("2026-09-10T21:15"));
  });

  it("対象日の前日から続く予約があっても、開始は対象日の0:00でクランプする", () => {
    const range = computeTimelineRange("2026-09-10", [
      { start: new Date("2026-09-09T23:00"), end: new Date("2026-09-10T07:00") },
    ]);
    expect(range.start).toEqual(new Date("2026-09-10T00:00"));
  });

  it("翌日にまたがる予約があっても、終了は対象日の24:00（翌0:00）でクランプする", () => {
    const range = computeTimelineRange("2026-09-10", [
      { start: new Date("2026-09-10T22:00"), end: new Date("2026-09-11T01:00") },
    ]);
    expect(range.end).toEqual(new Date("2026-09-11T00:00"));
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

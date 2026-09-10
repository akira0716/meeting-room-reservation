import { describe, it, expect } from "vitest";
import {
  computeTimelineRange,
  computeBlockLayoutPx,
  getTimelineHeightPx,
  getHourMarks,
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

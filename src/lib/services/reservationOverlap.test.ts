import { describe, it, expect } from "vitest";
import { isOverlapping } from "./reservationOverlap";

describe("isOverlapping", () => {
  it("時間帯が重なっている場合はtrueを返す", () => {
    expect(
      isOverlapping(
        { start: new Date("2026-09-10T10:00"), end: new Date("2026-09-10T11:00") },
        { start: new Date("2026-09-10T10:30"), end: new Date("2026-09-10T11:30") },
      ),
    ).toBe(true);
  });

  it("時間帯が重なっていない場合はfalseを返す", () => {
    expect(
      isOverlapping(
        { start: new Date("2026-09-10T10:00"), end: new Date("2026-09-10T11:00") },
        { start: new Date("2026-09-10T11:00"), end: new Date("2026-09-10T12:00") },
      ),
    ).toBe(false);
  });

  it("一方がもう一方を完全に内包している場合はtrueを返す", () => {
    expect(
      isOverlapping(
        { start: new Date("2026-09-10T09:00"), end: new Date("2026-09-10T12:00") },
        { start: new Date("2026-09-10T10:00"), end: new Date("2026-09-10T11:00") },
      ),
    ).toBe(true);
  });

  it("完全に離れた時間帯はfalseを返す", () => {
    expect(
      isOverlapping(
        { start: new Date("2026-09-10T09:00"), end: new Date("2026-09-10T10:00") },
        { start: new Date("2026-09-10T14:00"), end: new Date("2026-09-10T15:00") },
      ),
    ).toBe(false);
  });
});

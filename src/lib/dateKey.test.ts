import { describe, it, expect } from "vitest";
import { addDaysToDateKey, formatDateLabel, parseDateKey, toDateKey, toDatetimeLocalValue } from "./dateKey";

describe("toDateKey / parseDateKey", () => {
  it("DateをYYYY-MM-DD形式に変換できる", () => {
    expect(toDateKey(new Date(2026, 8, 6))).toBe("2026-09-06");
  });

  it("1桁の月・日は0埋めする", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("YYYY-MM-DDをローカル0時のDateに変換できる（往復一致）", () => {
    const parsed = parseDateKey("2026-09-06");
    expect(toDateKey(parsed)).toBe("2026-09-06");
    expect(parsed.getHours()).toBe(0);
  });
});

describe("addDaysToDateKey", () => {
  it("日をまたぐ加算ができる", () => {
    expect(addDaysToDateKey("2026-09-06", 1)).toBe("2026-09-07");
  });

  it("月をまたぐ加算ができる", () => {
    expect(addDaysToDateKey("2026-09-30", 1)).toBe("2026-10-01");
  });

  it("負の日数（前日・前週）にも対応する", () => {
    expect(addDaysToDateKey("2026-09-06", -1)).toBe("2026-09-05");
    expect(addDaysToDateKey("2026-09-06", -7)).toBe("2026-08-30");
  });
});

describe("formatDateLabel", () => {
  it("「M月D日(曜日)」形式のラベルを返す", () => {
    // 2026-09-06は日曜日
    expect(formatDateLabel("2026-09-06")).toBe("9月6日(日)");
  });
});

describe("toDatetimeLocalValue", () => {
  it("datetime-local inputのvalue形式に変換できる", () => {
    expect(toDatetimeLocalValue(new Date(2026, 8, 6, 9, 5))).toBe("2026-09-06T09:05");
  });
});

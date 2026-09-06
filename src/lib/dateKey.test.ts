import { describe, it, expect } from "vitest";
import {
  addDaysToDateKey,
  addMonthsToMonthKey,
  formatDateLabel,
  formatMonthLabel,
  getMonthGridDateKeys,
  parseDateKey,
  parseMonthKey,
  toDateKey,
  toDatetimeLocalValue,
  toMonthKey,
} from "./dateKey";

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

describe("toMonthKey / parseMonthKey", () => {
  it("DateをYYYY-MM形式に変換できる", () => {
    expect(toMonthKey(new Date(2026, 8, 6))).toBe("2026-09");
  });

  it("1桁の月は0埋めする", () => {
    expect(toMonthKey(new Date(2026, 0, 15))).toBe("2026-01");
  });

  it("YYYY-MMをその月の1日・ローカル0時のDateに変換できる（往復一致）", () => {
    const parsed = parseMonthKey("2026-09");
    expect(toMonthKey(parsed)).toBe("2026-09");
    expect(parsed.getDate()).toBe(1);
    expect(parsed.getHours()).toBe(0);
  });
});

describe("addMonthsToMonthKey", () => {
  it("月をまたぐ加算ができる", () => {
    expect(addMonthsToMonthKey("2026-09", 1)).toBe("2026-10");
  });

  it("年をまたぐ加算ができる", () => {
    expect(addMonthsToMonthKey("2026-12", 1)).toBe("2027-01");
  });

  it("負の月数（前月）にも対応する", () => {
    expect(addMonthsToMonthKey("2026-09", -1)).toBe("2026-08");
    expect(addMonthsToMonthKey("2027-01", -1)).toBe("2026-12");
  });
});

describe("formatMonthLabel", () => {
  it("「YYYY年M月」形式のラベルを返す", () => {
    expect(formatMonthLabel("2026-09")).toBe("2026年9月");
  });
});

describe("getMonthGridDateKeys", () => {
  it("月初が週の途中の場合、前月末の日で埋めて日曜始まりにする", () => {
    // 2026年9月1日は火曜日
    const keys = getMonthGridDateKeys("2026-09");
    expect(keys[0]).toBe("2026-08-30"); // 直前の日曜日
    expect(keys).toContain("2026-09-01");
  });

  it("7の倍数件（週単位）を返し、末尾は翌月の日で埋める", () => {
    const keys = getMonthGridDateKeys("2026-09");
    expect(keys.length % 7).toBe(0);
    expect(keys.length).toBe(35);
    expect(keys[keys.length - 1]).toBe("2026-10-03");
  });

  it("月内のすべての日を含む", () => {
    const keys = getMonthGridDateKeys("2026-09");
    for (let day = 1; day <= 30; day++) {
      expect(keys).toContain(`2026-09-${String(day).padStart(2, "0")}`);
    }
  });
});

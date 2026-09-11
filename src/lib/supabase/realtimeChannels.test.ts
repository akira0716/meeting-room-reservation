import { describe, it, expect } from "vitest";
import { floorMapChannelName } from "./realtimeChannels";

describe("floorMapChannelName", () => {
  it("組織IDを含むチャンネル名を返す", () => {
    expect(floorMapChannelName("org-123")).toBe("floor-map:org-123");
  });

  it("組織IDが違えば別のチャンネル名になる（組織間で混ざらない）", () => {
    expect(floorMapChannelName("org-a")).not.toBe(floorMapChannelName("org-b"));
  });
});

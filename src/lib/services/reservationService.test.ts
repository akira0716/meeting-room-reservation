import { describe, it, expect } from "vitest";
import { InMemoryReservationRepository } from "../repositories/inMemoryReservationRepository";
import {
  createReservation,
  updateReservation,
  ReservationConflictError,
} from "./reservationService";
import type { Reservation } from "../repositories/reservationRepository";

const ROOM_ID = "room-1";

function makeExistingReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: "res-existing",
    roomId: ROOM_ID,
    title: "既存の予約",
    bookerName: "山田",
    startAt: new Date("2026-09-10T10:00"),
    endAt: new Date("2026-09-10T11:00"),
    version: 1,
    ...overrides,
  };
}

describe("createReservation", () => {
  it("重複する時間帯があると作成できず、ReservationConflictErrorを投げる", async () => {
    const repo = new InMemoryReservationRepository([makeExistingReservation()]);

    await expect(
      createReservation(repo, {
        roomId: ROOM_ID,
        title: "新しい予約",
        bookerName: "佐藤",
        startAt: new Date("2026-09-10T10:30"),
        endAt: new Date("2026-09-10T11:30"),
      }),
    ).rejects.toThrow(ReservationConflictError);
  });

  it("重複がなければ予約を作成できる", async () => {
    const repo = new InMemoryReservationRepository([makeExistingReservation()]);

    const created = await createReservation(repo, {
      roomId: ROOM_ID,
      title: "新しい予約",
      bookerName: "佐藤",
      startAt: new Date("2026-09-10T11:00"),
      endAt: new Date("2026-09-10T12:00"),
    });

    expect(created.id).toBeDefined();
    expect(created.version).toBe(1);
  });
});

describe("updateReservation（楽観ロック）", () => {
  it("最新のversionで更新すればversionが+1されて成功する", async () => {
    const repo = new InMemoryReservationRepository([makeExistingReservation()]);

    const updated = await updateReservation(repo, "res-existing", 1, {
      title: "タイトル変更",
    });

    expect(updated.title).toBe("タイトル変更");
    expect(updated.version).toBe(2);
  });

  it("古いversionで更新しようとすると競合エラーになる（他のユーザーが先に更新済みのケース）", async () => {
    const repo = new InMemoryReservationRepository([makeExistingReservation()]);

    // Aさんが先に更新（version: 1 → 2）
    await updateReservation(repo, "res-existing", 1, { title: "Aさんによる変更" });

    // Bさんは古いversion(1)のまま更新しようとする → 競合エラー
    await expect(
      updateReservation(repo, "res-existing", 1, { title: "Bさんによる変更" }),
    ).rejects.toThrow(ReservationConflictError);

    // Aさんの変更が正として残っている
    const current = await repo.findById("res-existing");
    expect(current?.title).toBe("Aさんによる変更");
  });

  it("変更後の時間帯が他の予約と重複する場合は競合エラーになる", async () => {
    const target = makeExistingReservation();
    const other = makeExistingReservation({
      id: "res-other",
      startAt: new Date("2026-09-10T13:00"),
      endAt: new Date("2026-09-10T14:00"),
    });
    const repo = new InMemoryReservationRepository([target, other]);

    await expect(
      updateReservation(repo, "res-existing", 1, {
        startAt: new Date("2026-09-10T13:30"),
        endAt: new Date("2026-09-10T14:30"),
      }),
    ).rejects.toThrow(ReservationConflictError);
  });
});

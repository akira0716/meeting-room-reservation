import { isOverlapping } from "./reservationOverlap";
import type {
  NewReservation,
  Reservation,
  ReservationPatch,
  ReservationRepository,
} from "../repositories/reservationRepository";

/**
 * 予約の時間帯が既存の予約と重複している、または楽観ロックの競合が発生したときに投げる。
 * reasonで両者を区別できるようにしている：
 * - "overlap"：時間帯の入力をやり直せばよい
 * - "stale-version"：自分が編集を始めた後に他のユーザーが更新した。最新の内容を読み込み直す必要がある
 */
export class ReservationConflictError extends Error {
  readonly reason: "overlap" | "stale-version";

  constructor(message: string, reason: "overlap" | "stale-version") {
    super(message);
    this.name = "ReservationConflictError";
    this.reason = reason;
  }
}

/**
 * 新規予約を作成する。同じ会議室・重複する時間帯の予約が既にあれば作成せずエラーにする。
 */
export async function createReservation(
  repo: ReservationRepository,
  input: NewReservation,
): Promise<Reservation> {
  const existing = await repo.findActiveByRoomId(input.roomId);
  const hasConflict = existing.some((r) =>
    isOverlapping(
      { start: r.startAt, end: r.endAt },
      { start: input.startAt, end: input.endAt },
    ),
  );

  if (hasConflict) {
    throw new ReservationConflictError("指定の時間帯は既に他の予約と重複しています", "overlap");
  }

  return repo.create(input);
}

/**
 * 既存予約を更新する（時間変更を含む）。
 * 1. 変更後の時間帯が他の予約と重複していないか
 * 2. 自分が読み込んだ時点から他のユーザーに更新されていないか（楽観ロック）
 * の2つをチェックする。
 */
export async function updateReservation(
  repo: ReservationRepository,
  id: string,
  expectedVersion: number,
  patch: ReservationPatch,
): Promise<Reservation> {
  const target = await repo.findById(id);
  if (!target) {
    throw new Error("対象の予約が見つかりません");
  }

  const newStart = patch.startAt ?? target.startAt;
  const newEnd = patch.endAt ?? target.endAt;

  const others = (await repo.findActiveByRoomId(target.roomId)).filter(
    (r) => r.id !== id,
  );
  const hasConflict = others.some((r) =>
    isOverlapping({ start: r.startAt, end: r.endAt }, { start: newStart, end: newEnd }),
  );
  if (hasConflict) {
    throw new ReservationConflictError(
      "変更後の時間帯は既に他の予約と重複しています",
      "overlap",
    );
  }

  const updated = await repo.updateWithVersion(id, expectedVersion, patch);
  if (!updated) {
    throw new ReservationConflictError(
      "他のユーザーによってこの予約は更新されています。最新の内容を読み込み直してください。",
      "stale-version",
    );
  }
  return updated;
}

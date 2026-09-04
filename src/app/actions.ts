"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { DrizzleReservationRepository } from "@/lib/repositories/drizzleReservationRepository";
import {
  createReservation,
  ReservationConflictError,
} from "@/lib/services/reservationService";

export type CreateReservationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

/**
 * フロアマップから会議室を予約するServer Action。
 * 実際のDB書き込みはDrizzleReservationRepository経由で行い、
 * 重複チェックはreservationService（DB非依存のテスト済みロジック）に任せる。
 */
export async function createReservationAction(
  _prevState: CreateReservationState,
  formData: FormData,
): Promise<CreateReservationState> {
  const { member } = await getAuthContext();
  if (!member) {
    return { status: "error", message: "サインインしている組織メンバーのみ予約できます" };
  }

  const roomId = String(formData.get("roomId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const bookerName = String(formData.get("bookerName") ?? "").trim();
  const startAt = new Date(String(formData.get("startAt") ?? ""));
  const endAt = new Date(String(formData.get("endAt") ?? ""));

  if (!roomId || !title || !bookerName) {
    return { status: "error", message: "会議名・予約者名を入力してください" };
  }
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return { status: "error", message: "開始・終了時刻を正しく入力してください" };
  }
  if (startAt >= endAt) {
    return { status: "error", message: "終了時刻は開始時刻より後にしてください" };
  }

  const repo = new DrizzleReservationRepository();
  try {
    await createReservation(repo, { roomId, title, bookerName, startAt, endAt });
  } catch (err) {
    if (err instanceof ReservationConflictError) {
      return { status: "error", message: err.message };
    }
    throw err;
  }

  revalidatePath("/");
  return { status: "success" };
}

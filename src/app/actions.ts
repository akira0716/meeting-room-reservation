"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { DrizzleReservationRepository } from "@/lib/repositories/drizzleReservationRepository";
import {
  createReservation,
  updateReservation,
  ReservationConflictError,
} from "@/lib/services/reservationService";

export type CreateReservationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export type UpdateReservationState =
  | { status: "idle" }
  | { status: "error"; message: string; reason?: "overlap" | "stale-version" }
  | { status: "success" };

type ParsedReservationFields =
  | { ok: true; title: string; bookerName: string; startAt: Date; endAt: Date }
  | { ok: false; message: string };

function parseReservationFields(formData: FormData): ParsedReservationFields {
  const title = String(formData.get("title") ?? "").trim();
  const bookerName = String(formData.get("bookerName") ?? "").trim();
  const startAt = new Date(String(formData.get("startAt") ?? ""));
  const endAt = new Date(String(formData.get("endAt") ?? ""));

  if (!title || !bookerName) {
    return { ok: false, message: "会議名・予約者名を入力してください" };
  }
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return { ok: false, message: "開始・終了時刻を正しく入力してください" };
  }
  if (startAt >= endAt) {
    return { ok: false, message: "終了時刻は開始時刻より後にしてください" };
  }

  return { ok: true, title, bookerName, startAt, endAt };
}

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
  if (!roomId) {
    return { status: "error", message: "会議室を指定してください" };
  }

  const fields = parseReservationFields(formData);
  if (!fields.ok) {
    return { status: "error", message: fields.message };
  }

  const repo = new DrizzleReservationRepository();
  try {
    await createReservation(repo, { roomId, ...fields });
  } catch (err) {
    if (err instanceof ReservationConflictError) {
      return { status: "error", message: err.message };
    }
    throw err;
  }

  revalidatePath("/");
  return { status: "success" };
}

/**
 * 既存予約を編集するServer Action。楽観ロック（version）の競合はreason:"stale-version"として
 * 呼び出し側に伝え、UIで「最新の内容を読み込み直す」導線を出せるようにする。
 */
export async function updateReservationAction(
  _prevState: UpdateReservationState,
  formData: FormData,
): Promise<UpdateReservationState> {
  const { member } = await getAuthContext();
  if (!member) {
    return { status: "error", message: "サインインしている組織メンバーのみ編集できます" };
  }

  const id = String(formData.get("id") ?? "");
  const expectedVersion = Number(formData.get("version"));
  if (!id || Number.isNaN(expectedVersion)) {
    return { status: "error", message: "編集対象の予約が特定できません" };
  }

  const fields = parseReservationFields(formData);
  if (!fields.ok) {
    return { status: "error", message: fields.message };
  }

  const repo = new DrizzleReservationRepository();
  try {
    await updateReservation(repo, id, expectedVersion, fields);
  } catch (err) {
    if (err instanceof ReservationConflictError) {
      return { status: "error", message: err.message, reason: err.reason };
    }
    throw err;
  }

  revalidatePath("/");
  return { status: "success" };
}

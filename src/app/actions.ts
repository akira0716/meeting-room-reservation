"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { db } from "@/lib/db/client";
import { buildings, floors, rooms } from "@/lib/db/schema";
import { DrizzleReservationRepository } from "@/lib/repositories/drizzleReservationRepository";
import {
  createReservation,
  updateReservation,
  deleteReservation,
  ReservationConflictError,
} from "@/lib/services/reservationService";

/** 会議室の最小サイズ（px相当）。誤操作で潰れたサイズにならないようサーバー側でもクランプする */
const MIN_ROOM_SIZE = 20;

export type CreateReservationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export type UpdateReservationState =
  | { status: "idle" }
  | { status: "error"; message: string; reason?: "overlap" | "stale-version" }
  | { status: "success" };

export type DeleteReservationState =
  | { status: "idle" }
  | { status: "error"; message: string; reason?: "stale-version" }
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

/**
 * 既存予約を削除するServer Action。更新と同じく楽観ロックの競合を検出する。
 */
export async function deleteReservationAction(
  _prevState: DeleteReservationState,
  formData: FormData,
): Promise<DeleteReservationState> {
  const { member } = await getAuthContext();
  if (!member) {
    return { status: "error", message: "サインインしている組織メンバーのみ削除できます" };
  }

  const id = String(formData.get("id") ?? "");
  const expectedVersion = Number(formData.get("version"));
  if (!id || Number.isNaN(expectedVersion)) {
    return { status: "error", message: "削除対象の予約が特定できません" };
  }

  const repo = new DrizzleReservationRepository();
  try {
    await deleteReservation(repo, id, expectedVersion);
  } catch (err) {
    if (err instanceof ReservationConflictError) {
      return { status: "error", message: err.message, reason: "stale-version" };
    }
    throw err;
  }

  revalidatePath("/");
  return { status: "success" };
}

export type RoomPositionUpdate = {
  roomId: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

export type NewRoomInput = {
  name: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  capacity: number | null;
};

export type SaveFloorLayoutInput = {
  floorId: string;
  positionUpdates: RoomPositionUpdate[];
  newRooms: NewRoomInput[];
  deleteRoomIds: string[];
};

/**
 * フロア編集モードでの変更（会議室の移動・追加・削除）をまとめて保存する
 * （「保存」ボタン押下時のみ通信する）。フォームに紐づかない直接呼び出し用の
 * Server Action（管理者のみ）。1件ずつ都度保存すると通信状況によって画面反映が
 * 遅れて見えるため、確定操作でまとめて反映する設計にしている。
 *
 * 対象のフロアが自分の組織のものか、移動・削除対象の会議室がそのフロアに
 * 実在するかをサーバー側で検証してから書き込む（クライアントの入力を信用しない）。
 */
export async function saveFloorLayoutAction(
  input: SaveFloorLayoutInput,
): Promise<{ error?: string }> {
  const { member } = await getAuthContext();
  if (!member || member.role !== "admin") {
    return { error: "管理者のみ会議室を編集できます" };
  }

  const [floor] = await db
    .select({ id: floors.id, organizationId: buildings.organizationId })
    .from(floors)
    .innerJoin(buildings, eq(floors.buildingId, buildings.id))
    .where(eq(floors.id, input.floorId))
    .limit(1);
  if (!floor || floor.organizationId !== member.organizationId) {
    return { error: "対象のフロアが見つかりません" };
  }

  const existingRooms = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.floorId, input.floorId));
  const existingIds = new Set(existingRooms.map((r) => r.id));

  const positionUpdates = input.positionUpdates.filter((u) => existingIds.has(u.roomId));
  const deleteRoomIds = input.deleteRoomIds.filter((id) => existingIds.has(id));
  const newRooms = input.newRooms
    .map((r) => ({ ...r, name: r.name.trim() }))
    .filter((r) => r.name.length > 0);

  if (positionUpdates.length === 0 && deleteRoomIds.length === 0 && newRooms.length === 0) {
    return {};
  }

  await db.transaction(async (tx) => {
    for (const { roomId, positionX, positionY, width, height } of positionUpdates) {
      await tx
        .update(rooms)
        .set({
          positionX: Math.round(positionX),
          positionY: Math.round(positionY),
          width: Math.max(MIN_ROOM_SIZE, Math.round(width)),
          height: Math.max(MIN_ROOM_SIZE, Math.round(height)),
        })
        .where(eq(rooms.id, roomId));
    }
    for (const room of newRooms) {
      await tx.insert(rooms).values({
        floorId: input.floorId,
        name: room.name,
        positionX: Math.round(room.positionX),
        positionY: Math.round(room.positionY),
        width: Math.max(MIN_ROOM_SIZE, Math.round(room.width)),
        height: Math.max(MIN_ROOM_SIZE, Math.round(room.height)),
        capacity: room.capacity,
      });
    }
    if (deleteRoomIds.length > 0) {
      await tx.delete(rooms).where(inArray(rooms.id, deleteRoomIds));
    }
  });

  revalidatePath("/");
  return {};
}

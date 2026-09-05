"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { db } from "@/lib/db/client";
import { buildings, floors } from "@/lib/db/schema";

export type CreateFloorState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export type UpdateFloorState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export type DeleteFloorState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

type ParsedFloorFields =
  | { ok: true; floorNumber: number; label: string | null }
  | { ok: false; message: string };

function parseFloorFields(formData: FormData): ParsedFloorFields {
  const floorNumber = Number(formData.get("floorNumber"));
  const label = String(formData.get("label") ?? "").trim();

  if (!Number.isInteger(floorNumber)) {
    return { ok: false, message: "フロア番号は整数で入力してください（地下はマイナス）" };
  }

  return { ok: true, floorNumber, label: label || null };
}

/**
 * 「組織に1つだけ」の建物を取得する。すべてのフロア操作で共通して使う
 * （建物マスター管理は運用でカバーする方針のため、建物自体の作成・選択はここでは行わない）。
 */
async function getOwnBuilding(organizationId: string) {
  const [building] = await db
    .select()
    .from(buildings)
    .where(eq(buildings.organizationId, organizationId))
    .limit(1);
  return building ?? null;
}

/**
 * 指定したフロアが、自分の組織の建物のものかを検証する
 * （他組織のfloorIdを直接指定されても操作できてしまわないようにするための「組織所有チェック」）。
 */
async function isFloorInOrganization(floorId: string, organizationId: string): Promise<boolean> {
  const [floor] = await db
    .select({ organizationId: buildings.organizationId })
    .from(floors)
    .innerJoin(buildings, eq(floors.buildingId, buildings.id))
    .where(eq(floors.id, floorId))
    .limit(1);
  return floor?.organizationId === organizationId;
}

export async function createFloorAction(
  _prevState: CreateFloorState,
  formData: FormData,
): Promise<CreateFloorState> {
  const { member } = await getAuthContext();
  if (!member || member.role !== "admin") {
    return { status: "error", message: "管理者のみフロアを追加できます" };
  }

  const building = await getOwnBuilding(member.organizationId);
  if (!building) {
    return { status: "error", message: "建物が登録されていません" };
  }

  const fields = parseFloorFields(formData);
  if (!fields.ok) {
    return { status: "error", message: fields.message };
  }

  const [duplicate] = await db
    .select({ id: floors.id })
    .from(floors)
    .where(and(eq(floors.buildingId, building.id), eq(floors.floorNumber, fields.floorNumber)))
    .limit(1);
  if (duplicate) {
    return { status: "error", message: "そのフロア番号は既に登録されています" };
  }

  await db.insert(floors).values({
    buildingId: building.id,
    floorNumber: fields.floorNumber,
    label: fields.label,
  });

  revalidatePath("/admin/floors");
  revalidatePath("/");
  return { status: "success" };
}

export async function updateFloorAction(
  _prevState: UpdateFloorState,
  formData: FormData,
): Promise<UpdateFloorState> {
  const { member } = await getAuthContext();
  if (!member || member.role !== "admin") {
    return { status: "error", message: "管理者のみフロアを編集できます" };
  }

  const floorId = String(formData.get("floorId") ?? "");
  if (!floorId) {
    return { status: "error", message: "編集対象のフロアが特定できません" };
  }
  if (!(await isFloorInOrganization(floorId, member.organizationId))) {
    return { status: "error", message: "対象のフロアが見つかりません" };
  }

  const fields = parseFloorFields(formData);
  if (!fields.ok) {
    return { status: "error", message: fields.message };
  }

  const building = await getOwnBuilding(member.organizationId);
  if (!building) {
    return { status: "error", message: "建物が登録されていません" };
  }

  const [duplicate] = await db
    .select({ id: floors.id })
    .from(floors)
    .where(
      and(
        eq(floors.buildingId, building.id),
        eq(floors.floorNumber, fields.floorNumber),
        ne(floors.id, floorId),
      ),
    )
    .limit(1);
  if (duplicate) {
    return { status: "error", message: "そのフロア番号は既に登録されています" };
  }

  await db
    .update(floors)
    .set({ floorNumber: fields.floorNumber, label: fields.label })
    .where(eq(floors.id, floorId));

  revalidatePath("/admin/floors");
  revalidatePath("/");
  return { status: "success" };
}

/**
 * フロアを削除する。会議室・予約はDB側のonDelete:cascadeで連鎖削除される
 * （呼び出し側のUIで、件数を示した上での確認を必須にすること）。
 */
export async function deleteFloorAction(
  _prevState: DeleteFloorState,
  formData: FormData,
): Promise<DeleteFloorState> {
  const { member } = await getAuthContext();
  if (!member || member.role !== "admin") {
    return { status: "error", message: "管理者のみフロアを削除できます" };
  }

  const floorId = String(formData.get("floorId") ?? "");
  if (!floorId) {
    return { status: "error", message: "削除対象のフロアが特定できません" };
  }
  if (!(await isFloorInOrganization(floorId, member.organizationId))) {
    return { status: "error", message: "対象のフロアが見つかりません" };
  }

  await db.delete(floors).where(eq(floors.id, floorId));

  revalidatePath("/admin/floors");
  revalidatePath("/");
  return { status: "success" };
}

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { db } from "@/lib/db/client";
import { buildings, floors } from "@/lib/db/schema";

export type CreateFirstBuildingState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

/**
 * サインアップ直後、組織にまだ建物が1つも無い状態のオーナー（管理者）が
 * 最初の建物・フロアを登録するためのアクション。
 *
 * 会議室（room）はここでは作らない。追加はTASKS.mdの別タスク
 * （会議室の追加・削除をUIから行えるようにする）で対応する。
 */
export async function createFirstBuildingAction(
  _prevState: CreateFirstBuildingState,
  formData: FormData,
): Promise<CreateFirstBuildingState> {
  const { member } = await getAuthContext();
  if (!member || member.role !== "admin") {
    return { status: "error", message: "管理者のみ設定できます" };
  }

  const buildingName = String(formData.get("buildingName") ?? "").trim();
  const floorNumber = Number(formData.get("floorNumber"));
  const floorLabel = String(formData.get("floorLabel") ?? "").trim();

  if (!buildingName) {
    return { status: "error", message: "建物名を入力してください" };
  }
  if (!Number.isInteger(floorNumber)) {
    return { status: "error", message: "フロア番号は整数で入力してください（地下はマイナス）" };
  }

  // 誤って複数回作成されないよう、既に建物がある場合は何もしない
  const [existing] = await db
    .select()
    .from(buildings)
    .where(eq(buildings.organizationId, member.organizationId))
    .limit(1);
  if (existing) {
    return { status: "error", message: "建物は既に登録されています" };
  }

  const [building] = await db
    .insert(buildings)
    .values({ organizationId: member.organizationId, name: buildingName })
    .returning();

  await db.insert(floors).values({
    buildingId: building.id,
    floorNumber,
    label: floorLabel || null,
  });

  revalidatePath("/");
  return { status: "success" };
}

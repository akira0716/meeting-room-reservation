import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { db } from "@/lib/db/client";
import { buildings, floors, rooms } from "@/lib/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

const BUCKET = "floor-plans";
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// フロア図は縮小せず実ピクセルサイズのまま表示する設計（FloorMapView.tsx参照）
// のため、大きすぎる画像をそのまま許すと横スクロールが延々続くことになる。
// 「PC画面のスクリーンショット」程度の解像度を目安に、長辺をこのサイズまで
// 自動的に縮小する（縦横比は維持、これより小さい画像は拡大しない）。
const MAX_DIMENSION = 1920;

/**
 * フロア図（背景画像）をアップロードし、floorsテーブルにパスとサイズを保存する。
 * 管理者（自分の組織のフロアに限る）のみ実行できる。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ floorId: string }> },
) {
  const { member } = await getAuthContext();
  if (!member || member.role !== "admin") {
    return NextResponse.json({ error: "管理者のみ実行できます" }, { status: 403 });
  }

  const { floorId } = await params;

  const [floor] = await db
    .select({
      id: floors.id,
      organizationId: buildings.organizationId,
      prevWidth: floors.floorPlanImageWidth,
      prevHeight: floors.floorPlanImageHeight,
      prevPath: floors.floorPlanImagePath,
    })
    .from(floors)
    .innerJoin(buildings, eq(floors.buildingId, buildings.id))
    .where(eq(floors.id, floorId))
    .limit(1);
  if (!floor) {
    return NextResponse.json({ error: "指定されたフロアが見つかりません" }, { status: 404 });
  }
  if (floor.organizationId !== member.organizationId) {
    return NextResponse.json({ error: "他組織のフロアは操作できません" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "png / jpeg / webp形式の画像を選択してください" },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "画像サイズは5MB以内にしてください" }, { status: 400 });
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer());

  let buffer = originalBuffer;
  let width: number | undefined;
  let height: number | undefined;
  try {
    const original = sharp(originalBuffer);
    const originalMetadata = await original.metadata();
    if (
      originalMetadata.width &&
      originalMetadata.height &&
      (originalMetadata.width > MAX_DIMENSION || originalMetadata.height > MAX_DIMENSION)
    ) {
      // withoutEnlargement: falseで良いが、MAX_DIMENSION超のときしかここに来ないため実質不要。
      // fit: "inside"で縦横比を保ったまま長辺をMAX_DIMENSIONに収める（切り抜きはしない）。
      const resized = await original
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside" })
        .toBuffer({ resolveWithObject: true });
      buffer = resized.data;
      width = resized.info.width;
      height = resized.info.height;
    } else {
      width = originalMetadata.width;
      height = originalMetadata.height;
    }
  } catch {
    return NextResponse.json({ error: "画像を読み込めませんでした" }, { status: 400 });
  }
  if (!width || !height) {
    return NextResponse.json({ error: "画像サイズを取得できませんでした" }, { status: 400 });
  }

  const ext = file.type.split("/")[1];
  const objectPath = `${floorId}/${Date.now()}.${ext}`;

  const supabase = createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { error: `アップロードに失敗しました: ${uploadError.message}` },
      { status: 500 },
    );
  }

  // 差し替え前の画像と縦横比・サイズが変わる場合、既存の会議室の座標が
  // 新しい画像に対してずれてしまう。差し替え前後のサイズ比で会議室の
  // 位置・サイズを比例配分して補正する（フロア図の更新と同じトランザクションで行う）。
  await db.transaction(async (tx) => {
    await tx
      .update(floors)
      .set({
        floorPlanImagePath: objectPath,
        floorPlanImageWidth: width,
        floorPlanImageHeight: height,
      })
      .where(eq(floors.id, floorId));

    const { prevWidth, prevHeight } = floor;
    if (prevWidth && prevHeight && (prevWidth !== width || prevHeight !== height)) {
      const scaleX = width / prevWidth;
      const scaleY = height / prevHeight;
      const existingRooms = await tx.select().from(rooms).where(eq(rooms.floorId, floorId));
      for (const room of existingRooms) {
        await tx
          .update(rooms)
          .set({
            positionX: Math.round(room.positionX * scaleX),
            positionY: Math.round(room.positionY * scaleY),
            width: Math.max(20, Math.round(room.width * scaleX)),
            height: Math.max(20, Math.round(room.height * scaleY)),
          })
          .where(eq(rooms.id, room.id));
      }
    }
  });

  // 差し替え前の古い画像はストレージに残り続けるとゴミになるため削除する。
  // 新しい画像は既にDBに反映済みでレスポンスもこれから返すため、削除の失敗で
  // リクエスト自体を失敗させず、ベストエフォートで行う（ログのみ残す）。
  if (floor.prevPath && floor.prevPath !== objectPath) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([floor.prevPath]);
    if (removeError) {
      console.error("古いフロア図画像の削除に失敗しました:", removeError);
    }
  }

  revalidatePath("/");

  return NextResponse.json({ path: objectPath, width, height });
}

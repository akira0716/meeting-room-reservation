import { eq } from "drizzle-orm";
import { imageSize } from "image-size";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { db } from "@/lib/db/client";
import { buildings, floors } from "@/lib/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

const BUCKET = "floor-plans";
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

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
    .select({ id: floors.id, organizationId: buildings.organizationId })
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

  const buffer = Buffer.from(await file.arrayBuffer());

  let dimensions: { width?: number; height?: number };
  try {
    dimensions = imageSize(buffer);
  } catch {
    return NextResponse.json({ error: "画像を読み込めませんでした" }, { status: 400 });
  }
  if (!dimensions.width || !dimensions.height) {
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

  await db
    .update(floors)
    .set({
      floorPlanImagePath: objectPath,
      floorPlanImageWidth: dimensions.width,
      floorPlanImageHeight: dimensions.height,
    })
    .where(eq(floors.id, floorId));

  revalidatePath("/");

  return NextResponse.json({
    path: objectPath,
    width: dimensions.width,
    height: dimensions.height,
  });
}

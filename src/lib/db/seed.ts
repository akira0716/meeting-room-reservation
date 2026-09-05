/**
 * ポートフォリオ用のダミーデータ投入スクリプト。
 * 実行: npm run db:seed
 *
 * 「デモ株式会社」を find-or-create し、その組織にぶら下がる建物・フロア・会議室・予約だけを
 * 削除してから再投入する（冪等）。usersは意図的に一切触らない
 * ―― organizationsをdeleteするとON DELETE CASCADEでusersも消えてしまい、
 * 認証で紐づけたアカウントが壊れるため。管理者ユーザーの投入は npm run auth:seed-admins を使う。
 */
import { eq } from "drizzle-orm";
import { db } from "./client";
import { organizations, buildings, floors, rooms, reservations, users } from "./schema";

async function main() {
  console.log("組織を確認しています...");
  const [existingOrg] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.name, "デモ株式会社"))
    .limit(1);

  const org =
    existingOrg ??
    (await db.insert(organizations).values({ name: "デモ株式会社" }).returning())[0];

  console.log("既存のフロアマップデータを削除しています...");
  // buildingsをdeleteすればfloors/rooms/reservationsはON DELETE CASCADEで一緒に消える
  await db.delete(buildings).where(eq(buildings.organizationId, org.id));

  console.log("建物・フロアを投入しています...");
  const [building] = await db
    .insert(buildings)
    .values({ organizationId: org.id, name: "本社ビル" })
    .returning();

  const [floor3] = await db
    .insert(floors)
    .values({ buildingId: building.id, floorNumber: 3 })
    .returning();

  const [floor5] = await db
    .insert(floors)
    .values({ buildingId: building.id, floorNumber: 5 })
    .returning();

  console.log("会議室を投入しています...");
  const [roomA, roomB, roomC] = await db
    .insert(rooms)
    .values([
      {
        floorId: floor3.id,
        name: "会議室A",
        positionX: 40,
        positionY: 40,
        width: 160,
        height: 100,
        capacity: 4,
      },
      {
        floorId: floor3.id,
        name: "会議室B",
        positionX: 220,
        positionY: 40,
        width: 200,
        height: 100,
        capacity: 8,
      },
      {
        floorId: floor3.id,
        name: "会議室C",
        positionX: 440,
        positionY: 40,
        width: 260,
        height: 140,
        capacity: 20,
      },
    ])
    .returning();

  const [roomD, roomE] = await db
    .insert(rooms)
    .values([
      {
        floorId: floor5.id,
        name: "会議室D",
        positionX: 40,
        positionY: 40,
        width: 180,
        height: 100,
        capacity: 6,
      },
      {
        floorId: floor5.id,
        name: "会議室E",
        positionX: 240,
        positionY: 40,
        width: 220,
        height: 120,
        capacity: 12,
      },
    ])
    .returning();

  console.log("予約データを投入しています...");
  // 予約者はこの組織の誰か1人（いれば）に紐づけておく。usersは意図的に触らない方針
  // （上記コメント参照）のため、既存の行を探すだけで新規作成はしない
  const [demoUser] = await db
    .select()
    .from(users)
    .where(eq(users.organizationId, org.id))
    .limit(1);
  const createdByUserId = demoUser?.id ?? null;

  const now = new Date();
  const addMinutes = (base: Date, minutes: number) =>
    new Date(base.getTime() + minutes * 60_000);

  await db.insert(reservations).values([
    // 今まさに使用中の予約（会議室A）→ デモ時に「使用中」表示を確認できる
    {
      roomId: roomA.id,
      title: "定例ミーティング",
      createdByUserId,
      startAt: addMinutes(now, -15),
      endAt: addMinutes(now, 45),
    },
    // 今日この後の予約（会議室B）
    {
      roomId: roomB.id,
      title: "採用面接",
      createdByUserId,
      startAt: addMinutes(now, 120),
      endAt: addMinutes(now, 180),
    },
    // 明日の予約（会議室C）
    {
      roomId: roomC.id,
      title: "全社キックオフ",
      createdByUserId,
      startAt: addMinutes(now, 24 * 60),
      endAt: addMinutes(now, 24 * 60 + 90),
    },
    // 5F 会議室Dは終日空き（予約なし）
    // 会議室Eは少し先に埋まっている
    {
      roomId: roomE.id,
      title: "1on1",
      createdByUserId,
      startAt: addMinutes(now, 60),
      endAt: addMinutes(now, 90),
    },
  ]);

  console.log("シード完了。");
  console.log({
    organization: org.name,
    building: building.name,
    floors: [floor3.floorNumber, floor5.floorNumber],
    rooms: [roomA, roomB, roomC, roomD, roomE].map((r) => r.name),
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));

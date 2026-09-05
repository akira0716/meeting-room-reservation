import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { toDateKey } from "../dateKey";
import { db } from "../db/client";
import { buildings, floors, organizations, reservations, rooms, users } from "../db/schema";
import { getFloorPlanImageUrl } from "../supabase/publicClient";

/** 予約者の氏名・メールアドレスがどちらも取得できない場合のフォールバック表示
 *  （予約者アカウントが組織から削除された、またはユーザー紐付け導入前の予約データ） */
const UNKNOWN_BOOKER_LABEL = "予約者不明";

export type RoomReservation = {
  id: string;
  title: string;
  /** 表示用の予約者名（氏名優先、無ければメールアドレス、それも無ければUNKNOWN_BOOKER_LABEL） */
  bookerName: string;
  /** 予約作成時のユーザーID。ログイン中ユーザー本人の予約かどうかの判定に使う（削除済みならnull） */
  createdByUserId: string | null;
  /** 任意の備考欄 */
  note: string | null;
  startAt: Date;
  endAt: Date;
  version: number;
};

export type RoomWithReservations = {
  id: string;
  name: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  capacity: number | null;
  reservations: RoomReservation[];
  isOccupiedNow: boolean;
};

export type FloorWithRooms = {
  id: string;
  floorNumber: number;
  label: string | null;
  rooms: RoomWithReservations[];
  floorPlanImageUrl: string | null;
  floorPlanImageWidth: number | null;
  floorPlanImageHeight: number | null;
};

export type FloorMapData = {
  organizationName: string;
  buildingName: string;
  /** 表示対象の日付（"YYYY-MM-DD"、ローカル日付） */
  date: string;
  /** dateが今日かどうか。falseの場合、isOccupiedNow（"今まさに使用中か"）は常にfalseになる
   *  （過去・未来の日付には「今」という概念が無いため） */
  isToday: boolean;
  floors: FloorWithRooms[];
};

/**
 * フロアマップ表示に必要なデータをまとめて取得する。
 * 引数のorganizationId（＝ログイン中メンバーの所属組織）でスコープする。
 * 1組織につき建物は1つだけ想定しているため、先頭の建物を採用する。
 * targetDate（省略時は今日）の1日分の予約のみ取得し、今日を見ている場合に限り
 * 各部屋について「今まさに使用中か」も合わせて計算する。
 */
export async function getFloorMapData(
  organizationId: string,
  targetDate: Date = new Date(),
): Promise<FloorMapData | null> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) return null;

  const [building] = await db
    .select()
    .from(buildings)
    .where(eq(buildings.organizationId, org.id))
    .limit(1);
  if (!building) return null;

  const floorRows = await db
    .select()
    .from(floors)
    .where(eq(floors.buildingId, building.id));

  const floorIds = floorRows.map((f) => f.id);
  const roomRows = floorIds.length
    ? await db.select().from(rooms).where(inArray(rooms.floorId, floorIds))
    : [];

  const roomIds = roomRows.map((r) => r.id);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // 予約者名の表示用に、作成者のusers行をleft joinで引く（削除済み・未設定ならnullのまま）
  const reservationRows = roomIds.length
    ? await db
        .select({
          id: reservations.id,
          roomId: reservations.roomId,
          title: reservations.title,
          note: reservations.note,
          createdByUserId: reservations.createdByUserId,
          bookerName: users.name,
          bookerEmail: users.email,
          startAt: reservations.startAt,
          endAt: reservations.endAt,
          version: reservations.version,
        })
        .from(reservations)
        .leftJoin(users, eq(reservations.createdByUserId, users.id))
        .where(
          and(
            inArray(reservations.roomId, roomIds),
            lte(reservations.startAt, endOfDay),
            gte(reservations.endAt, startOfDay),
          ),
        )
    : [];

  const now = new Date();
  const isToday = now >= startOfDay && now <= endOfDay;

  const floorsData: FloorWithRooms[] = floorRows
    .sort((a, b) => a.floorNumber - b.floorNumber)
    .map((floor) => ({
      id: floor.id,
      floorNumber: floor.floorNumber,
      label: floor.label,
      floorPlanImageUrl: floor.floorPlanImagePath
        ? getFloorPlanImageUrl(floor.floorPlanImagePath)
        : null,
      floorPlanImageWidth: floor.floorPlanImageWidth,
      floorPlanImageHeight: floor.floorPlanImageHeight,
      rooms: roomRows
        .filter((room) => room.floorId === floor.id)
        .map((room) => {
          const roomReservations: RoomReservation[] = reservationRows
            .filter((res) => res.roomId === room.id)
            .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
            .map((res) => ({
              id: res.id,
              title: res.title,
              note: res.note,
              createdByUserId: res.createdByUserId,
              bookerName: res.bookerName ?? res.bookerEmail ?? UNKNOWN_BOOKER_LABEL,
              startAt: res.startAt,
              endAt: res.endAt,
              version: res.version,
            }));
          const isOccupiedNow =
            isToday && roomReservations.some((res) => res.startAt <= now && now < res.endAt);
          return { ...room, reservations: roomReservations, isOccupiedNow };
        }),
    }));

  return {
    organizationName: org.name,
    buildingName: building.name,
    date: toDateKey(targetDate),
    isToday,
    floors: floorsData,
  };
}

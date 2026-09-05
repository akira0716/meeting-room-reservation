import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../db/client";
import { buildings, floors, organizations, reservations, rooms } from "../db/schema";
import { getFloorPlanImageUrl } from "../supabase/publicClient";

export type RoomReservation = {
  id: string;
  title: string;
  bookerName: string;
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
  floors: FloorWithRooms[];
};

/**
 * フロアマップ表示に必要なデータをまとめて取得する。
 * 引数のorganizationId（＝ログイン中メンバーの所属組織）でスコープする。
 * 1組織につき建物は1つだけ想定しているため、先頭の建物を採用する。
 * 「本日分」の予約のみ取得し、各部屋について「今まさに使用中か」も合わせて計算する。
 */
export async function getFloorMapData(organizationId: string): Promise<FloorMapData | null> {
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
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const reservationRows = roomIds.length
    ? await db
        .select()
        .from(reservations)
        .where(
          and(
            inArray(reservations.roomId, roomIds),
            lte(reservations.startAt, endOfDay),
            gte(reservations.endAt, startOfDay),
          ),
        )
    : [];

  const now = new Date();

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
          const roomReservations = reservationRows
            .filter((res) => res.roomId === room.id)
            .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
          const isOccupiedNow = roomReservations.some(
            (res) => res.startAt <= now && now < res.endAt,
          );
          return { ...room, reservations: roomReservations, isOccupiedNow };
        }),
    }));

  return {
    organizationName: org.name,
    buildingName: building.name,
    floors: floorsData,
  };
}

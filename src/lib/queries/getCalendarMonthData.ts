import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { getMonthGridDateKeys, parseDateKey, toDateKey } from "../dateKey";
import { db } from "../db/client";
import { buildings, floors, organizations, reservations, rooms, users } from "../db/schema";

/** 予約者の氏名・メールアドレスがどちらも取得できない場合のフォールバック表示
 *  （getFloorMapData.tsと同じ意味。予約者アカウントが組織から削除された、
 *  またはユーザー紐付け導入前の予約データ） */
const UNKNOWN_BOOKER_LABEL = "予約者不明";

export type CalendarReservation = {
  id: string;
  roomId: string;
  roomName: string;
  /** フロアの表示ラベル（"3F"やカスタムのlabel） */
  floorLabel: string;
  title: string;
  note: string | null;
  /** 表示用の予約者名（氏名優先、無ければメールアドレス、それも無ければUNKNOWN_BOOKER_LABEL） */
  bookerName: string;
  /** ログイン中ユーザー本人の予約かどうかの判定に使う（削除済みならnull） */
  createdByUserId: string | null;
  startAt: Date;
  endAt: Date;
  /** startAtのローカル日付（"YYYY-MM-DD"）。カレンダーの日付枠への振り分けに使う */
  dateKey: string;
};

export type CalendarMonthData = {
  organizationName: string;
  buildingName: string;
  /** 表示対象の月（"YYYY-MM"） */
  monthKey: string;
  /** 月表示グリッドの範囲（前月末・翌月頭のパディング日を含む）に開始する組織内の
   *  全予約（会議室・フロアをまたいで横断的に持つ） */
  reservations: CalendarReservation[];
};

function floorLabelFor(floor: { floorNumber: number; label: string | null }): string {
  return floor.label ?? `${floor.floorNumber}F`;
}

/**
 * カレンダー画面表示に必要なデータをまとめて取得する。
 * 引数のorganizationId（＝ログイン中メンバーの所属組織）でスコープする。
 * 1組織につき建物は1つだけ想定しているため、先頭の建物を採用する
 * （getFloorMapData.tsと同じ前提）。
 *
 * 取得範囲はmonthKeyの暦月そのものではなく、月表示グリッド（前月末・翌月頭の
 * パディング日を含む、日曜始まりの週で埋めた範囲）に合わせる。これにより、
 * グリッド上に薄く表示される前月末・翌月頭の日をクリックしても、その日の
 * 予約状況が正しく表示できる（会議室予約は同日中に終わる想定のため、
 * getFloorMapData.tsの「1日単位」の前提と同様、日をまたぐ予約は考慮しない）。
 */
export async function getCalendarMonthData(
  organizationId: string,
  monthKey: string,
): Promise<CalendarMonthData | null> {
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

  const gridDateKeys = getMonthGridDateKeys(monthKey);
  const rangeStart = parseDateKey(gridDateKeys[0]);
  const rangeEndExclusive = new Date(parseDateKey(gridDateKeys[gridDateKeys.length - 1]));
  rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);

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
        })
        .from(reservations)
        .leftJoin(users, eq(reservations.createdByUserId, users.id))
        .where(
          and(
            inArray(reservations.roomId, roomIds),
            gte(reservations.startAt, rangeStart),
            lt(reservations.startAt, rangeEndExclusive),
          ),
        )
    : [];

  const roomById = new Map(roomRows.map((r) => [r.id, r]));
  const floorById = new Map(floorRows.map((f) => [f.id, f]));

  const calendarReservations: CalendarReservation[] = reservationRows
    .map((res) => {
      const room = roomById.get(res.roomId);
      const floor = room ? floorById.get(room.floorId) : undefined;
      return {
        id: res.id,
        roomId: res.roomId,
        roomName: room?.name ?? "（不明な会議室）",
        floorLabel: floor ? floorLabelFor(floor) : "",
        title: res.title,
        note: res.note,
        bookerName: res.bookerName ?? res.bookerEmail ?? UNKNOWN_BOOKER_LABEL,
        createdByUserId: res.createdByUserId,
        startAt: res.startAt,
        endAt: res.endAt,
        dateKey: toDateKey(res.startAt),
      };
    })
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return {
    organizationName: org.name,
    buildingName: building.name,
    monthKey,
    reservations: calendarReservations,
  };
}

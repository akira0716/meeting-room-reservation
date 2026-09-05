import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { CreateFloorForm } from "@/components/CreateFloorForm";
import { FloorRow } from "@/components/FloorRow";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { db } from "@/lib/db/client";
import { buildings, floors, reservations, rooms } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminFloorsPage() {
  const { authUser, member } = await getAuthContext();

  if (!authUser) {
    redirect("/login?next=/admin/floors");
  }
  if (!member || member.role !== "admin") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-8">
        <p className="text-sm text-rose-600 dark:text-rose-400">
          このページは管理者のみ利用できます。
        </p>
      </main>
    );
  }

  const [building] = await db
    .select()
    .from(buildings)
    .where(eq(buildings.organizationId, member.organizationId))
    .limit(1);

  if (!building) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-8">
        <AdminNav current="/admin/floors" />
        <p className="mt-6 text-sm text-neutral-500">
          建物がまだ登録されていません。先にトップページから建物・最初のフロアを登録してください。
        </p>
      </main>
    );
  }

  const floorRows = await db
    .select()
    .from(floors)
    .where(eq(floors.buildingId, building.id));
  const floorIds = floorRows.map((f) => f.id);

  const roomRows = floorIds.length
    ? await db.select({ id: rooms.id, floorId: rooms.floorId }).from(rooms).where(inArray(rooms.floorId, floorIds))
    : [];
  const roomIds = roomRows.map((r) => r.id);
  const floorIdByRoomId = new Map(roomRows.map((r) => [r.id, r.floorId]));

  // フロア削除時の警告表示用。日付を絞らず全期間の予約件数を数える
  // （削除すればその会議室に紐づく予約履歴もすべて消えるため）
  const reservationRows = roomIds.length
    ? await db.select({ roomId: reservations.roomId }).from(reservations).where(inArray(reservations.roomId, roomIds))
    : [];

  const roomCountByFloor = new Map<string, number>();
  for (const room of roomRows) {
    roomCountByFloor.set(room.floorId, (roomCountByFloor.get(room.floorId) ?? 0) + 1);
  }
  const reservationCountByFloor = new Map<string, number>();
  for (const reservation of reservationRows) {
    const floorId = floorIdByRoomId.get(reservation.roomId);
    if (!floorId) continue;
    reservationCountByFloor.set(floorId, (reservationCountByFloor.get(floorId) ?? 0) + 1);
  }

  const sortedFloors = [...floorRows].sort((a, b) => a.floorNumber - b.floorNumber);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <AdminNav current="/admin/floors" />
      <h1 className="mt-4 text-xl font-semibold">フロア管理</h1>
      <p className="mt-1 text-sm text-neutral-500">{building.name}</p>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-neutral-500">フロアを追加</h2>
        <div className="mt-2">
          <CreateFloorForm />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-500">フロア一覧</h2>
        {sortedFloors.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">フロアがまだ登録されていません</p>
        ) : (
          <ul className="mt-2 divide-y divide-black/5 dark:divide-white/5">
            {sortedFloors.map((floor) => (
              <FloorRow
                key={floor.id}
                floor={floor}
                roomCount={roomCountByFloor.get(floor.id) ?? 0}
                reservationCount={reservationCountByFloor.get(floor.id) ?? 0}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

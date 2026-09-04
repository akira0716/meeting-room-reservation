import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { reservations as reservationsTable } from "../db/schema";
import type {
  NewReservation,
  Reservation,
  ReservationPatch,
  ReservationRepository,
} from "./reservationRepository";

/**
 * Supabase(Postgres)にアクセスする本番用の実装。
 * ドメイン層はReservationRepositoryインターフェースにのみ依存しているため、
 * テストではこのファイルを経由せずInMemoryReservationRepositoryに差し替えられる。
 */
export class DrizzleReservationRepository implements ReservationRepository {
  async findActiveByRoomId(roomId: string): Promise<Reservation[]> {
    return db
      .select()
      .from(reservationsTable)
      .where(eq(reservationsTable.roomId, roomId));
  }

  async findById(id: string): Promise<Reservation | null> {
    const rows = await db
      .select()
      .from(reservationsTable)
      .where(eq(reservationsTable.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(input: NewReservation): Promise<Reservation> {
    const rows = await db.insert(reservationsTable).values(input).returning();
    return rows[0];
  }

  async updateWithVersion(
    id: string,
    expectedVersion: number,
    patch: ReservationPatch,
  ): Promise<Reservation | null> {
    const rows = await db
      .update(reservationsTable)
      .set({ ...patch, version: sql`${reservationsTable.version} + 1` })
      .where(
        and(
          eq(reservationsTable.id, id),
          eq(reservationsTable.version, expectedVersion),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }
}

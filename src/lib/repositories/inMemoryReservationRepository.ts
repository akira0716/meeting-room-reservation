import type {
  NewReservation,
  Reservation,
  ReservationPatch,
  ReservationRepository,
} from "./reservationRepository";

/**
 * テスト用のインメモリ実装。実DB(Supabase)を使わずにサービス層の挙動を確認するために使う。
 */
export class InMemoryReservationRepository implements ReservationRepository {
  private reservations: Reservation[] = [];
  private nextId = 1;

  constructor(seed: Reservation[] = []) {
    this.reservations = [...seed];
  }

  async findActiveByRoomId(roomId: string): Promise<Reservation[]> {
    return this.reservations.filter((r) => r.roomId === roomId);
  }

  async findById(id: string): Promise<Reservation | null> {
    return this.reservations.find((r) => r.id === id) ?? null;
  }

  async create(input: NewReservation): Promise<Reservation> {
    const reservation: Reservation = {
      ...input,
      id: `res-${this.nextId++}`,
      version: 1,
    };
    this.reservations.push(reservation);
    return reservation;
  }

  async updateWithVersion(
    id: string,
    expectedVersion: number,
    patch: ReservationPatch,
  ): Promise<Reservation | null> {
    const index = this.reservations.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const current = this.reservations[index];
    if (current.version !== expectedVersion) {
      // 期待していたversionと違う = 他のユーザーが先に更新した(競合)
      return null;
    }

    const updated: Reservation = {
      ...current,
      ...patch,
      version: current.version + 1,
    };
    this.reservations[index] = updated;
    return updated;
  }
}

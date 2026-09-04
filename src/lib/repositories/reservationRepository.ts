export type Reservation = {
  id: string;
  roomId: string;
  title: string;
  bookerName: string;
  startAt: Date;
  endAt: Date;
  version: number;
};

export type NewReservation = Omit<Reservation, "id" | "version">;

export type ReservationPatch = Partial<
  Pick<Reservation, "title" | "bookerName" | "startAt" | "endAt">
>;

/**
 * 予約データへのアクセスを抽象化するインターフェース。
 * サービス層はこのインターフェースにのみ依存し、Supabase(Postgres)への依存を持たない。
 * → テスト時はInMemoryReservationRepositoryに差し替えることで、DBなしでサービス層をテストできる。
 */
export interface ReservationRepository {
  findActiveByRoomId(roomId: string): Promise<Reservation[]>;
  findById(id: string): Promise<Reservation | null>;
  create(input: NewReservation): Promise<Reservation>;
  /**
   * 楽観ロック付きの更新。
   * expectedVersionが現在のversionと一致する場合のみ更新し、versionを+1する。
   * 一致しない（＝他のユーザーが先に更新した）場合はnullを返す。
   */
  updateWithVersion(
    id: string,
    expectedVersion: number,
    patch: ReservationPatch,
  ): Promise<Reservation | null>;
}

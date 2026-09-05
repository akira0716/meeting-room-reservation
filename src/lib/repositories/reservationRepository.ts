export type Reservation = {
  id: string;
  roomId: string;
  title: string;
  /** 予約作成時のログイン中ユーザー（固定・変更不可）。ユーザーが組織から削除されるとnullになる */
  createdByUserId: string | null;
  /** 任意の備考欄（旧bookerName廃止に伴い追加。URL等も入力可） */
  note: string | null;
  startAt: Date;
  endAt: Date;
  version: number;
};

export type NewReservation = Omit<Reservation, "id" | "version">;

/** 更新時にcreatedByUserIdは含まない（予約者は作成時のまま変更不可のため） */
export type ReservationPatch = Partial<Pick<Reservation, "title" | "note" | "startAt" | "endAt">>;

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
  /**
   * 楽観ロック付きの削除。expectedVersionが現在のversionと一致する場合のみ削除する。
   * 一致しない（＝他のユーザーが先に更新/削除した）場合はfalseを返す。
   */
  deleteWithVersion(id: string, expectedVersion: number): Promise<boolean>;
}

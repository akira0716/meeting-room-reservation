"use client";

import { useActionState, useState } from "react";
import { createReservationAction, type CreateReservationState } from "@/app/actions";
import type { RoomReservation, RoomWithReservations } from "@/lib/queries/getFloorMapData";
import { EditReservationForm } from "./EditReservationForm";

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
});

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

const initialState: CreateReservationState = { status: "idle" };

function ReservationRow({ reservation }: { reservation: RoomReservation }) {
  const [showEdit, setShowEdit] = useState(false);

  if (showEdit) {
    return (
      <li>
        {/* versionをkeyにすることで、他のユーザーの更新をrouter.refresh()で取り込んだ際に
            フォームが最新の初期値で作り直される（useActionStateの状態もリセットされる） */}
        <EditReservationForm
          key={reservation.version}
          reservation={reservation}
          onClose={() => setShowEdit(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded border border-black/5 bg-neutral-50 px-2 py-1 text-sm dark:border-white/5 dark:bg-neutral-800">
      <div>
        <span className="font-mono text-xs text-neutral-500">
          {timeFormatter.format(reservation.startAt)}–{timeFormatter.format(reservation.endAt)}
        </span>{" "}
        <span className="font-medium">{reservation.title}</span>
        <span className="text-neutral-500">（{reservation.bookerName}）</span>
      </div>
      <button
        type="button"
        onClick={() => setShowEdit(true)}
        className="shrink-0 text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        編集
      </button>
    </li>
  );
}

function BookingForm({
  roomId,
  onClose,
  initialRange,
}: {
  roomId: string;
  onClose: () => void;
  /** 検索条件で指定した開始・終了時刻（datetime-local文字列）。指定時はこれを初期値にする */
  initialRange?: { start: string; end: string };
}) {
  const [state, formAction] = useActionState(createReservationAction, initialState);

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setMinutes(Math.ceil(defaultStart.getMinutes() / 30) * 30, 0, 0);
  const defaultEnd = new Date(defaultStart.getTime() + 30 * 60_000);
  const defaultStartValue = initialRange?.start ?? toDatetimeLocalValue(defaultStart);
  const defaultEndValue = initialRange?.end ?? toDatetimeLocalValue(defaultEnd);

  // 予約成功後は、一覧側はServer Actionのrevalidatによって最新化される。
  // ここではフォームの代わりに完了メッセージを出し、ユーザーの操作（閉じる）でパネルを閉じる。
  if (state.status === "success") {
    return (
      <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300">
        予約が完了しました。
        <button
          type="button"
          onClick={onClose}
          className="ml-2 underline underline-offset-2"
        >
          閉じる
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-2">
      <input type="hidden" name="roomId" value={roomId} />
      <div>
        <label className="block text-xs font-medium text-neutral-500">会議名</label>
        <input
          name="title"
          required
          className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-500">予約者名</label>
        <input
          name="bookerName"
          required
          className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-500">開始</label>
          <input
            type="datetime-local"
            name="startAt"
            required
            defaultValue={defaultStartValue}
            className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-500">終了</label>
          <input
            type="datetime-local"
            name="endAt"
            required
            defaultValue={defaultEndValue}
            className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
          />
        </div>
      </div>

      {state.status === "error" && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{state.message}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          予約を確定する
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

export function RoomDetailPanel({
  room,
  onClose,
  initialBookingRange,
}: {
  room: RoomWithReservations;
  /** フロアマップ上のポップオーバーとして表示している場合の閉じるボタン。指定時のみ表示する */
  onClose?: () => void;
  /** 会議室検索で開始・終了時刻を指定していた場合、予約フォームの初期値として引き継ぐ */
  initialBookingRange?: { start: string; end: string };
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{room.name}</h2>
        <div className="flex items-center gap-2">
          <span
            className={
              room.isOccupiedNow
                ? "rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                : "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            }
          >
            {room.isOccupiedNow ? "使用中" : "空き"}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              ×
            </button>
          )}
        </div>
      </div>
      {room.capacity != null && (
        <p className="mt-1 text-sm text-neutral-500">定員 {room.capacity}名</p>
      )}

      <h3 className="mt-4 text-sm font-medium text-neutral-500">本日の予約</h3>
      {room.reservations.length === 0 ? (
        <p className="mt-1 text-sm text-neutral-400">本日の予約はありません</p>
      ) : (
        // 予約件数によってパネルの高さが変動しないよう、一定件数を超えたら内側でスクロールさせる
        <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto">
          {room.reservations.map((r) => (
            <ReservationRow key={r.id} reservation={r} />
          ))}
        </ul>
      )}

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-4 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          この部屋を予約する
        </button>
      ) : (
        <BookingForm
          roomId={room.id}
          onClose={() => setShowForm(false)}
          initialRange={initialBookingRange}
        />
      )}
    </div>
  );
}

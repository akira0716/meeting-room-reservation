"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { updateReservationAction, type UpdateReservationState } from "@/app/actions";
import type { RoomReservation } from "@/lib/queries/getFloorMapData";

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

const initialState: UpdateReservationState = { status: "idle" };

export function EditReservationForm({
  reservation,
  onClose,
}: {
  reservation: RoomReservation;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateReservationAction, initialState);

  // 楽観ロックの競合（他のユーザーが先に更新した）。入力を上書きせず、読み込み直す操作を促す。
  if (state.status === "error" && state.reason === "stale-version") {
    return (
      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-300">
        {state.message}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            最新の内容を読み込み直す
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  // 更新に成功すると、呼び出し元(ReservationRow)がreservation.versionの変化を検知して
  // このフォームをkey違いで再マウントする（＝新しい値が入った状態のこのフォームが再表示される）。
  // そのため"success"状態がユーザーに見える瞬間は実質的に無く、専用の完了メッセージは出していない。

  return (
    <form action={formAction} className="mt-2 space-y-2 rounded-md border border-black/10 bg-neutral-50 p-2 dark:border-white/10 dark:bg-neutral-800">
      <input type="hidden" name="id" value={reservation.id} />
      <input type="hidden" name="version" value={reservation.version} />
      <div>
        <label className="block text-xs font-medium text-neutral-500">会議名</label>
        <input
          name="title"
          required
          defaultValue={reservation.title}
          className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-500">予約者名</label>
        <input
          name="bookerName"
          required
          defaultValue={reservation.bookerName}
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
            defaultValue={toDatetimeLocalValue(reservation.startAt)}
            className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-500">終了</label>
          <input
            type="datetime-local"
            name="endAt"
            required
            defaultValue={toDatetimeLocalValue(reservation.endAt)}
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
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          更新する
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

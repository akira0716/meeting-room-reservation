"use client";

import { useActionState, useState } from "react";
import {
  deleteFloorAction,
  updateFloorAction,
  type DeleteFloorState,
  type UpdateFloorState,
} from "@/app/admin/floors/actions";

type Floor = { id: string; floorNumber: number; label: string | null };

const updateInitialState: UpdateFloorState = { status: "idle" };
const deleteInitialState: DeleteFloorState = { status: "idle" };

function floorDisplayName(floor: Floor): string {
  return floor.label ?? `${floor.floorNumber}F`;
}

export function FloorRow({
  floor,
  roomCount,
  reservationCount,
}: {
  floor: Floor;
  /** このフロアに属する会議室の数（削除時の警告表示に使う） */
  roomCount: number;
  /** このフロアの会議室に紐づく予約の総数（本日分に限らず全期間。削除時の警告表示に使う） */
  reservationCount: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [updateState, updateAction] = useActionState(updateFloorAction, updateInitialState);
  const [deleteState, deleteAction] = useActionState(deleteFloorAction, deleteInitialState);

  if (isEditing) {
    return (
      <li className="rounded border border-black/5 bg-neutral-50 p-2 dark:border-white/5 dark:bg-neutral-800">
        <form action={updateAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="floorId" value={floor.id} />
          <div>
            <label className="block text-xs font-medium text-neutral-500">フロア番号</label>
            <input
              type="number"
              name="floorNumber"
              required
              step={1}
              defaultValue={floor.floorNumber}
              className="mt-0.5 w-32 rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500">表示名（任意）</label>
            <input
              type="text"
              name="label"
              defaultValue={floor.label ?? ""}
              className="mt-0.5 w-56 rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            保存
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            {updateState.status === "success" ? "閉じる" : "キャンセル"}
          </button>
        </form>
        {updateState.status === "error" && (
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{updateState.message}</p>
        )}
        {/* 保存後もフォームは開いたままにする（EditReservationFormと同様の方針）。
            成功メッセージで結果だけ伝え、閉じるかどうかは操作者に委ねる */}
        {updateState.status === "success" && (
          <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">保存しました。</p>
        )}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 py-2 text-sm">
      <div>
        <span className="font-medium">{floorDisplayName(floor)}</span>
        <span className="ml-2 text-xs text-neutral-500">
          会議室{roomCount}件・予約{reservationCount}件
        </span>
        {deleteState.status === "error" && (
          <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{deleteState.message}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          編集
        </button>
        <form
          action={deleteAction}
          onSubmit={(e) => {
            const message =
              roomCount > 0 || reservationCount > 0
                ? `「${floorDisplayName(floor)}」を削除すると、会議室${roomCount}件・予約${reservationCount}件もすべて削除されます。元に戻せません。削除しますか？`
                : `「${floorDisplayName(floor)}」を削除します。元に戻せません。削除しますか？`;
            if (!window.confirm(message)) e.preventDefault();
          }}
        >
          <input type="hidden" name="floorId" value={floor.id} />
          <button
            type="submit"
            className="text-rose-600 underline underline-offset-2 hover:text-rose-800 dark:text-rose-400"
          >
            削除
          </button>
        </form>
      </div>
    </li>
  );
}

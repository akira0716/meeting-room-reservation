"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { deleteReservationAction, type DeleteReservationState } from "@/app/actions";

const initialState: DeleteReservationState = { status: "idle" };

/**
 * 予約削除ボタン。誤操作防止のため「削除する」→「本当に削除しますか？」の2段階確認にしている。
 * 削除も楽観ロック付き（他のユーザーが先に更新/削除していたら競合エラーになる）。
 */
export function DeleteReservationButton({
  reservationId,
  version,
}: {
  reservationId: string;
  version: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(deleteReservationAction, initialState);

  if (state.status === "error" && state.reason === "stale-version") {
    return (
      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-300">
        {state.message}
        <button
          type="button"
          onClick={() => router.refresh()}
          className="ml-2 underline underline-offset-2"
        >
          最新の内容を読み込み直す
        </button>
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md px-3 py-1.5 text-xs text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
      >
        削除する
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={reservationId} />
      <input type="hidden" name="version" value={version} />
      <span className="text-xs text-neutral-500">本当に削除しますか？</span>
      <button
        type="submit"
        className="rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700"
      >
        削除する
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        キャンセル
      </button>
      {state.status === "error" && (
        <span className="text-xs text-rose-600 dark:text-rose-400">{state.message}</span>
      )}
    </form>
  );
}

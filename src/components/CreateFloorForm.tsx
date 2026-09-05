"use client";

import { useActionState } from "react";
import { createFloorAction, type CreateFloorState } from "@/app/admin/floors/actions";

const initialState: CreateFloorState = { status: "idle" };

export function CreateFloorForm() {
  const [state, formAction] = useActionState(createFloorAction, initialState);

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-neutral-500">フロア番号</label>
          <input
            type="number"
            name="floorNumber"
            required
            step={1}
            placeholder="地下はマイナス（B1なら-1）"
            className="mt-0.5 w-40 rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500">表示名（任意）</label>
          <input
            type="text"
            name="label"
            placeholder="屋上 など。未入力なら「1F」のように表示"
            className="mt-0.5 w-56 rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          追加する
        </button>
      </form>

      {state.status === "error" && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{state.message}</p>
      )}
      {state.status === "success" && (
        <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
          フロアを追加しました。
        </p>
      )}
    </div>
  );
}

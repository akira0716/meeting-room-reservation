"use client";

import { useActionState } from "react";
import {
  createFirstBuildingAction,
  type CreateFirstBuildingState,
} from "@/app/onboarding/actions";

const initialState: CreateFirstBuildingState = { status: "idle" };

export function CreateFirstBuildingForm() {
  const [state, formAction] = useActionState(createFirstBuildingAction, initialState);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-neutral-500">建物名</label>
        <input
          type="text"
          name="buildingName"
          required
          placeholder="本社ビル"
          className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
        />
      </div>
      <div className="flex gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-500">フロア番号</label>
          <input
            type="number"
            name="floorNumber"
            required
            defaultValue={1}
            step={1}
            placeholder="地下はマイナス（B1なら-1）"
            className="mt-0.5 w-32 rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-500">
            フロア表示名（任意）
          </label>
          <input
            type="text"
            name="floorLabel"
            placeholder="屋上 など。未入力なら「1F」のように表示"
            className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
          />
        </div>
      </div>
      {state.status === "error" && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{state.message}</p>
      )}
      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        登録する
      </button>
    </form>
  );
}

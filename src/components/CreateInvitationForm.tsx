"use client";

import { useActionState } from "react";
import {
  createInvitationAction,
  type CreateInvitationState,
} from "@/app/admin/invitations/actions";

const initialState: CreateInvitationState = { status: "idle" };

export function CreateInvitationForm() {
  const [state, formAction] = useActionState(createInvitationAction, initialState);

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-neutral-500">メールアドレス</label>
          <input
            type="email"
            name="email"
            required
            className="mt-0.5 rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500">権限</label>
          <select
            name="role"
            defaultValue="member"
            className="mt-0.5 rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
          >
            <option value="member">一般メンバー</option>
            <option value="admin">管理者</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          招待する
        </button>
      </form>

      {state.status === "error" && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{state.message}</p>
      )}
      {state.status === "success" && (
        <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
          招待しました。メールは送信されません。本人にログインURLを伝え、「Googleでサインイン」を押してもらってください。
        </p>
      )}
    </div>
  );
}

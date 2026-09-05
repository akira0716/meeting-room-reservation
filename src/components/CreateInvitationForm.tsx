"use client";

import { useActionState } from "react";
import {
  createInvitationAction,
  type CreateInvitationState,
} from "@/app/admin/invitations/actions";
import { CopyLoginUrlButton } from "@/components/CopyLoginUrlButton";

const initialState: CreateInvitationState = { status: "idle" };

export function CreateInvitationForm() {
  const [state, formAction] = useActionState(createInvitationAction, initialState);

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-neutral-500">
            メールアドレス（1行に1件）
          </label>
          <textarea
            name="emails"
            required
            rows={3}
            placeholder={"taro@example.com\nhanako@example.com"}
            className="mt-0.5 w-64 rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
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
        <div className="mt-2 space-y-1 text-sm">
          <p className="text-emerald-600 dark:text-emerald-400">
            {state.invited.length}件招待しました（{state.invited.join(", ")}）。
            メールは送信されません。本人にログインURLを伝え、「Googleでサインイン」を押してもらってください。
          </p>
          {state.skipped.length > 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              メールアドレスの形式が不正なためスキップ：{state.skipped.join(", ")}
            </p>
          )}
          <CopyLoginUrlButton />
        </div>
      )}
    </div>
  );
}

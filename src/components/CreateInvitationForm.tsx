"use client";

import { useActionState, useState } from "react";
import {
  createInvitationAction,
  type CreateInvitationState,
} from "@/app/admin/invitations/actions";

const initialState: CreateInvitationState = { status: "idle" };

export function CreateInvitationForm() {
  const [state, formAction] = useActionState(createInvitationAction, initialState);
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <form
        action={(formData) => {
          setCopied(false);
          formAction(formData);
        }}
        className="flex flex-wrap items-end gap-2"
      >
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
          招待リンクを発行
        </button>
      </form>

      {state.status === "error" && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{state.message}</p>
      )}
      {state.status === "success" && (
        <div className="mt-2 flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-sm dark:border-emerald-900 dark:bg-emerald-900/30">
          <code className="break-all">{`${typeof window !== "undefined" ? window.location.origin : ""}${state.invitePath}`}</code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}${state.status === "success" ? state.invitePath : ""}`,
              );
              setCopied(true);
            }}
            className="shrink-0 rounded border border-black/10 px-2 py-0.5 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
          >
            {copied ? "コピー済み" : "コピー"}
          </button>
        </div>
      )}
    </div>
  );
}

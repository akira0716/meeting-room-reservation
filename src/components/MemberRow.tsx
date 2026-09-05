"use client";

import { useActionState } from "react";
import {
  removeMemberAction,
  updateMemberRoleAction,
  type RemoveMemberState,
  type UpdateMemberRoleState,
} from "@/app/admin/invitations/actions";

type Member = {
  id: string;
  email: string;
  role: "admin" | "member";
  status: "invited" | "active";
};

const roleLabel: Record<Member["role"], string> = { admin: "管理者", member: "一般メンバー" };
const statusLabel: Record<Member["status"], string> = { active: "参加済み", invited: "招待中" };

const roleInitialState: UpdateMemberRoleState = { status: "idle" };
const removeInitialState: RemoveMemberState = { status: "idle" };

export function MemberRow({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const [roleState, roleAction] = useActionState(updateMemberRoleAction, roleInitialState);
  const [removeState, removeAction] = useActionState(removeMemberAction, removeInitialState);
  const nextRole: Member["role"] = member.role === "admin" ? "member" : "admin";

  return (
    <li className="flex items-center justify-between gap-2 py-2 text-sm">
      <div>
        <span>{member.email}</span>
        <span className="ml-2 text-xs text-neutral-500">
          {roleLabel[member.role]}・{statusLabel[member.status]}
          {isSelf && "（自分）"}
        </span>
        {roleState.status === "error" && (
          <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{roleState.message}</p>
        )}
        {removeState.status === "error" && (
          <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{removeState.message}</p>
        )}
      </div>

      {!isSelf && (
        <div className="flex shrink-0 items-center gap-3 text-xs">
          <form action={roleAction}>
            <input type="hidden" name="memberId" value={member.id} />
            <input type="hidden" name="role" value={nextRole} />
            <button
              type="submit"
              className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              {nextRole === "admin" ? "管理者にする" : "一般メンバーにする"}
            </button>
          </form>
          <form
            action={removeAction}
            onSubmit={(e) => {
              const message =
                member.status === "invited"
                  ? `${member.email} への招待を取り消しますか？`
                  : `${member.email} を組織から削除しますか？この操作は元に戻せません。`;
              if (!window.confirm(message)) e.preventDefault();
            }}
          >
            <input type="hidden" name="memberId" value={member.id} />
            <button
              type="submit"
              className="text-rose-600 underline underline-offset-2 hover:text-rose-800 dark:text-rose-400"
            >
              削除
            </button>
          </form>
        </div>
      )}
    </li>
  );
}

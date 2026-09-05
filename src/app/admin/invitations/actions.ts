"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export type CreateInvitationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; invited: string[]; skipped: string[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * メンバーを招待する（複数行入力で一括登録に対応）。
 *
 * Google認証（Auth.js）に一本化したことで、招待はusersテーブルに
 * status:"invited" の行を作るだけの「許可リスト登録」になった。
 * メールの送信は行わない：招待された本人は、ログイン画面の
 * 「Googleでサインイン」を自分から押すだけでよい（管理者から、招待した旨と
 * ログインURL——[`CopyLoginUrlButton`](../../../components/CopyLoginUrlButton.tsx)で
 * コピーできる——を直接伝える運用を想定）。signIn()コールバック（src/auth.ts）が
 * 「そのメールアドレスのusers行が存在するか」を見て可否を決め、
 * 初回サインイン時にactiveへ更新する。
 */
export async function createInvitationAction(
  _prevState: CreateInvitationState,
  formData: FormData,
): Promise<CreateInvitationState> {
  const { member } = await getAuthContext();
  if (!member || member.role !== "admin") {
    return { status: "error", message: "管理者のみ招待を作成できます" };
  }

  const role = String(formData.get("role") ?? "member");
  if (role !== "admin" && role !== "member") {
    return { status: "error", message: "権限の指定が不正です" };
  }

  // 改行・カンマ区切りで複数件に対応。空行は無視し、重複は1件にまとめる
  const rawEmails = String(formData.get("emails") ?? "");
  const candidates = Array.from(
    new Set(
      rawEmails
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );

  if (candidates.length === 0) {
    return { status: "error", message: "メールアドレスを入力してください" };
  }

  const invited: string[] = [];
  const skipped: string[] = [];

  for (const email of candidates) {
    if (!EMAIL_RE.test(email)) {
      skipped.push(email);
      continue;
    }

    await db
      .insert(users)
      .values({
        organizationId: member.organizationId,
        email,
        role,
        status: "invited",
        invitedBy: member.id,
      })
      .onConflictDoUpdate({
        target: [users.organizationId, users.email],
        // 既にactiveなメンバーを再招待した場合、status/authUserIdは上書きしない（権限だけ更新する）
        set: { role },
      });
    invited.push(email);
  }

  revalidatePath("/admin/invitations");
  return { status: "success", invited, skipped };
}

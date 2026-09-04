"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export type CreateInvitationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

/**
 * メンバーを招待する。
 *
 * 認証はGoogle認証のみのため、招待は「usersテーブルに status:"invited" の行を
 * 先に作っておく」だけで完結する（メール送信は不要）。招待された人が該当の
 * メールアドレスのGoogleアカウントでサインインすると、getAuthContext()が
 * 「authUserId未設定・同じメールアドレスのusers行」を自動的に見つけて紐付け、
 * status を active にする。
 *
 * 誰にどのGoogleアカウントでサインインしてほしいかは、管理者がSlack等で
 * 案内する運用を想定している。
 */
export async function createInvitationAction(
  _prevState: CreateInvitationState,
  formData: FormData,
): Promise<CreateInvitationState> {
  const { member } = await getAuthContext();
  if (!member || member.role !== "admin") {
    return { status: "error", message: "管理者のみ招待を作成できます" };
  }

  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "member");
  if (!email) {
    return { status: "error", message: "メールアドレスを入力してください" };
  }
  if (role !== "admin" && role !== "member") {
    return { status: "error", message: "権限の指定が不正です" };
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

  revalidatePath("/admin/invitations");
  return { status: "success" };
}

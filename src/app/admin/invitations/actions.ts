"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export type CreateInvitationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

/**
 * メンバーを招待する。
 * 1. usersテーブルに status:"invited" の行を先に作っておく（authUserIdはまだnull）
 * 2. Supabase Authの招待メールを送信する（管理者向けsecret keyクライアントを使用）
 *
 * 招待された人がメール内のリンクをクリックしてサインインすると、getAuthContext()が
 * 「authUserId未設定・同じメールアドレスのusers行」を見つけて自動的に紐付け、
 * status を active にする（招待受諾用の別ページは不要）。
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

  const origin = await getOrigin();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/set-password")}`,
  });

  if (error) {
    return {
      status: "error",
      message: `招待メールの送信に失敗しました: ${error.message}`,
    };
  }

  revalidatePath("/admin/invitations");
  return { status: "success" };
}

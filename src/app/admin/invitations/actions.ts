"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export type CreateInvitationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export type UpdateMemberRoleState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export type RemoveMemberState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

/**
 * メンバーを招待する。
 *
 * Google認証（Auth.js）に一本化したことで、招待はusersテーブルに
 * status:"invited" の行を作るだけの「許可リスト登録」になった。
 * メールの送信は行わない：招待された本人は、ログイン画面の
 * 「Googleでサインイン」を自分から押すだけでよい（管理者から、招待した旨と
 * ログインURLを直接伝える運用を想定。ログインURLはアプリのURLと同じなので、
 * 招待のたびに個別のURLを発行・案内する必要はない）。signIn()コールバック
 * （src/auth.ts）が「そのメールアドレスのusers行が存在するか」を見て可否を
 * 決め、初回サインイン時にactiveへ更新する。
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

/**
 * メンバーのロール（admin/member）を変更する。
 *
 * 自分自身のロールは変更できない（最後の管理者が誤って一般メンバーに
 * 降格し、以降誰も管理画面を操作できなくなる事故を防ぐため）。
 * 「他の管理者を降格する」操作は許可される＝実行者自身は必ず管理者のまま
 * 残るため、この制約だけで組織の管理者が0人になる事態を防げる。
 */
export async function updateMemberRoleAction(
  _prevState: UpdateMemberRoleState,
  formData: FormData,
): Promise<UpdateMemberRoleState> {
  const { member } = await getAuthContext();
  if (!member || member.role !== "admin") {
    return { status: "error", message: "管理者のみ権限を変更できます" };
  }

  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!memberId) {
    return { status: "error", message: "対象のメンバーが特定できません" };
  }
  if (role !== "admin" && role !== "member") {
    return { status: "error", message: "権限の指定が不正です" };
  }
  if (memberId === member.id) {
    return { status: "error", message: "自分自身の権限は変更できません" };
  }

  const [target] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, memberId))
    .limit(1);
  if (!target || target.organizationId !== member.organizationId) {
    return { status: "error", message: "対象のメンバーが見つかりません" };
  }

  await db.update(users).set({ role }).where(eq(users.id, memberId));

  revalidatePath("/admin/invitations");
  return { status: "success" };
}

/**
 * メンバーを組織から削除する（招待の取り消し・参加済みメンバーの除名の両方を兼ねる）。
 * usersテーブルの行そのものを削除するだけで、認可はこの行の有無で判定している
 * （signIn/jwtコールバック）ため、これだけで以後サインインできなくなる。
 *
 * 自分自身は削除できない（ロール変更と同じ理由）。
 */
export async function removeMemberAction(
  _prevState: RemoveMemberState,
  formData: FormData,
): Promise<RemoveMemberState> {
  const { member } = await getAuthContext();
  if (!member || member.role !== "admin") {
    return { status: "error", message: "管理者のみメンバーを削除できます" };
  }

  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) {
    return { status: "error", message: "対象のメンバーが特定できません" };
  }
  if (memberId === member.id) {
    return { status: "error", message: "自分自身を削除することはできません" };
  }

  const [target] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, memberId))
    .limit(1);
  if (!target || target.organizationId !== member.organizationId) {
    return { status: "error", message: "対象のメンバーが見つかりません" };
  }

  await db.delete(users).where(eq(users.id, memberId));

  revalidatePath("/admin/invitations");
  return { status: "success" };
}

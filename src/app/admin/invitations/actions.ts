"use server";

import { randomUUID } from "node:crypto";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { db } from "@/lib/db/client";
import { invitations } from "@/lib/db/schema";
import { revalidatePath } from "next/cache";

const INVITATION_EXPIRES_IN_DAYS = 7;

export type CreateInvitationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; invitePath: string };

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

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(invitations).values({
    organizationId: member.organizationId,
    email,
    token,
    role,
    invitedBy: member.id,
    expiresAt,
  });

  revalidatePath("/admin/invitations");

  return { status: "success", invitePath: `/invite/${token}` };
}

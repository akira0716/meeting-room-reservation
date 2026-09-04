import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { invitations, users } from "@/lib/db/schema";
import { createSupabaseAuthServerClient } from "@/lib/supabase/serverAuthClient";

/**
 * 招待の承諾。/auth/callback でサインイン済みの状態でここに来る想定。
 * サインイン中のメールアドレスが招待のメールアドレスと一致すれば、usersテーブルに
 * organizationId/role/authUserId/status=active を書き込み、招待をacceptedAt済みにする。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const { origin } = new URL(request.url);

  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);

  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return NextResponse.redirect(`${origin}/invite/${token}`);
  }

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser || authUser.email !== invitation.email) {
    // サインインしているメールアドレスが招待と異なる（別ブラウザで開いた等）
    return NextResponse.redirect(`${origin}/invite/${token}`);
  }

  await db
    .insert(users)
    .values({
      organizationId: invitation.organizationId,
      authUserId: authUser.id,
      email: invitation.email,
      role: invitation.role,
      status: "active",
      invitedBy: invitation.invitedBy,
    })
    .onConflictDoUpdate({
      target: [users.organizationId, users.email],
      set: { authUserId: authUser.id, role: invitation.role, status: "active" },
    });

  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  return NextResponse.redirect(`${origin}/set-password`);
}

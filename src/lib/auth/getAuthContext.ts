import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";
import { createSupabaseAuthServerClient } from "../supabase/serverAuthClient";

export type OrgMember = {
  id: string;
  organizationId: string;
  email: string;
  name: string | null;
  role: "admin" | "member";
  status: "invited" | "active";
};

export type AuthContext = {
  /** Supabase Auth側の認証情報。未サインインならnull */
  authUser: { id: string; email: string } | null;
  /** このアプリの組織メンバーとしての情報。未サインイン、または招待されていない場合はnull */
  member: OrgMember | null;
};

/**
 * 現在のリクエストのSupabase Authセッションと、users テーブルの組織メンバー情報を突き合わせる。
 *
 * - 未サインイン → { authUser: null, member: null }
 * - サインイン済みで、authUserIdが一致するusers行がある → そのまま返す
 * - サインイン済みで、authUserIdはまだ紐づいていないが、同じメールアドレスのusers行がある
 *   （管理者のconfigシード直後、または招待受諾直後）→ このタイミングで紐付けてactiveにする
 * - どちらにも該当しない（招待されていないメールアドレスでサインインした）→ member: null
 */
export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser || !authUser.email) {
    return { authUser: null, member: null };
  }

  const authUserInfo = { id: authUser.id, email: authUser.email };

  const [byAuthId] = await db
    .select()
    .from(users)
    .where(eq(users.authUserId, authUser.id))
    .limit(1);
  if (byAuthId) {
    return { authUser: authUserInfo, member: byAuthId };
  }

  const [byEmail] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, authUser.email), isNull(users.authUserId)))
    .limit(1);

  if (!byEmail) {
    return { authUser: authUserInfo, member: null };
  }

  const [linked] = await db
    .update(users)
    .set({ authUserId: authUser.id, status: "active" })
    .where(eq(users.id, byEmail.id))
    .returning();

  return { authUser: authUserInfo, member: linked };
}

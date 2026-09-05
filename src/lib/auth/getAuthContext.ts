import { auth } from "@/auth";
import type { OrgMember } from "./types";

export type { OrgMember };

export type AuthContext = {
  /** Auth.js側の認証情報。未サインインならnull */
  authUser: { id: string; email: string } | null;
  /** このアプリの組織メンバーとしての情報。未サインイン、または招待されていない場合はnull */
  member: OrgMember | null;
};

/**
 * 現在のリクエストのAuth.js（Google OAuth）セッションを取得する。
 *
 * role・organizationId等の認可情報は、signIn/jwtコールバック（[auth.ts](../../auth.ts)）の
 * 時点でusersテーブルから読み込み、セッションに積んである。ここではそれを取り出すだけで、
 * DBには問い合わせない。
 *
 * - 未サインイン → { authUser: null, member: null }
 * - サインイン済みだが招待されていないメールアドレス → { authUser: 値あり, member: null }
 * - サインイン済み・招待済み → member にrole等が入る
 */
export async function getAuthContext(): Promise<AuthContext> {
  const session = await auth();

  if (!session?.user?.email) {
    return { authUser: null, member: null };
  }

  return {
    authUser: { id: session.member?.id ?? session.user.email, email: session.user.email },
    member: session.member ?? null,
  };
}

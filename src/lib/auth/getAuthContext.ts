import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";

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
 * 【認証・認可は設計をやり直すため一時的に無効化中】
 *
 * 本来はSupabase Authのセッションとusersテーブルを突き合わせて認可判定していたが
 * （実装は git log の 64cad7f 時点を参照）、招待メールのリダイレクト設計を含めて
 * 認証方式自体を設計からやり直すことになったため、一旦すべてのアクセスを
 * 「seed-admins.jsonでシードされた管理者」として扱うダミー実装に差し替えている。
 *
 * 呼び出し側（各Server Action・APIルート）のインターフェースは変えていないので、
 * このファイルだけを本来のSupabase Auth連携実装に戻せば認可チェックは復活する。
 * TASKS.mdの「認証・認可の再設計」を参照。
 */
export async function getAuthContext(): Promise<AuthContext> {
  const [admin] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);

  if (!admin) {
    return { authUser: null, member: null };
  }

  return {
    authUser: { id: admin.authUserId ?? admin.id, email: admin.email },
    member: admin,
  };
}

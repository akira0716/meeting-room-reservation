import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { organizations, users } from "@/lib/db/schema";
import type { OrgMember } from "@/lib/auth/types";
import { OWNER_SIGNUP_ORG_NAME_COOKIE } from "@/lib/auth/ownerSignup";

/**
 * 認証はAuth.js（Google OAuthのみ）に任せ、「組織のメンバーかどうか・role」の
 * 認可情報は引き続き自前のusersテーブルを真実の情報源として持つ。
 *
 * 招待の仕組み：管理者が管理ページでusersテーブルにstatus:"invited"の行を
 * 作っておく（＝許可リスト）。本人はメールのリンクを踏む必要はなく、
 * ログイン画面の「Googleでサインイン」を押すだけでよい。signIn()コールバックで
 * 「そのメールアドレスのusers行が存在するか」だけを見て可否を決める。
 *
 * これとは別に、/signupから来た「新しい組織のオーナーになる」サインインも
 * 受け付ける（[`ownerSignup.ts`](./lib/auth/ownerSignup.ts)のCookie参照）。
 * こちらはusers行がまだ存在しない前提で、jwt()コールバックの中で
 * organizations行とusers行（role: admin）を新規作成する。
 *
 * セッションはJWT戦略（DBアダプタなし）。Auth.js自身のuser/accountテーブルは
 * 使わず、jwt()コールバックの中でusersテーブルを都度引いてrole等をtokenに載せる。
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const [member] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      const cookieStore = await cookies();
      const pendingOrgName = cookieStore.get(OWNER_SIGNUP_ORG_NAME_COOKIE)?.value;

      if (pendingOrgName) {
        // /signup（新しい組織のオーナー登録）から来たサインイン。
        // 1つのメールアドレスは1つの組織にのみ所属できる設計のため、
        // 既にどこかの組織に所属（招待中も含む）済みなら新規組織作成は拒否する。
        if (member) {
          cookieStore.delete(OWNER_SIGNUP_ORG_NAME_COOKIE);
          return "/signup?error=AlreadyMember";
        }
        // Cookieはここでは消さない。実際の組織作成とCookie削除はjwt()側で行う
        return true;
      }

      // 通常の（既存組織への）サインイン：招待済みメンバーのみ許可する
      return Boolean(member);
    },
    async jwt({ token, account, profile }) {
      const email = profile?.email ?? token.email;
      if (!email) return token;

      let [member] = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (!member) {
        // usersテーブルに行が無い＝招待された既存メンバーではない。
        // signIn()を通過できたのは/signup発行のCookieがある場合のみのはずなので、
        // ここで新しい組織とオーナー（管理者）ユーザーを作成する。
        const cookieStore = await cookies();
        const pendingOrgName = cookieStore.get(OWNER_SIGNUP_ORG_NAME_COOKIE)?.value;
        if (!pendingOrgName || !account?.providerAccountId) {
          delete token.member;
          return token;
        }

        const [org] = await db
          .insert(organizations)
          .values({ name: pendingOrgName })
          .returning();
        [member] = await db
          .insert(users)
          .values({
            organizationId: org.id,
            authUserId: account.providerAccountId,
            email,
            name: typeof profile?.name === "string" ? profile.name : null,
            role: "admin",
            status: "active",
          })
          .returning();

        cookieStore.delete(OWNER_SIGNUP_ORG_NAME_COOKIE);
      } else {
        // 既存メンバー（招待済み・参加済み問わず）のサインイン。
        // バグ修正：招待経由のメンバーはusers行作成時に名前を入力する手段が無く
        // （createInvitationActionはメールアドレスのみで作成する）、これまでnameが
        // 常にnullのままになっていた（アバターメニューに名前が表示されない不具合）。
        // Googleプロフィールのnameが取れていて、かつDB側と異なる場合は都度同期する。
        const patch: { authUserId?: string; status?: "active"; name?: string } = {};
        if (account?.providerAccountId && (!member.authUserId || member.status === "invited")) {
          // 初回サインイン時、Googleのsub（安定したアカウントID）を紐付けてactiveにする
          patch.authUserId = account.providerAccountId;
          patch.status = "active";
        }
        if (typeof profile?.name === "string" && profile.name && profile.name !== member.name) {
          patch.name = profile.name;
        }
        if (Object.keys(patch).length > 0) {
          await db.update(users).set(patch).where(eq(users.id, member.id));
          member = { ...member, ...patch };
        }
      }

      const orgMember: OrgMember = {
        id: member.id,
        organizationId: member.organizationId,
        email: member.email,
        name: member.name,
        role: member.role,
        status: member.status,
      };
      token.member = orgMember;
      return token;
    },
    async session({ session, token }) {
      session.member = token.member ?? null;
      return session;
    },
  },
});

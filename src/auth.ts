import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import type { OrgMember } from "@/lib/auth/types";

/**
 * 認証はAuth.js（Google OAuthのみ）に任せ、「組織のメンバーかどうか・role」の
 * 認可情報は引き続き自前のusersテーブルを真実の情報源として持つ。
 *
 * 招待の仕組み：管理者が管理ページでusersテーブルにstatus:"invited"の行を
 * 作っておく（＝許可リスト）。本人はメールのリンクを踏む必要はなく、
 * ログイン画面の「Googleでサインイン」を押すだけでよい。signIn()コールバックで
 * 「そのメールアドレスのusers行が存在するか」だけを見て可否を決める。
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
      // 招待されていない（usersテーブルに行がない）メールアドレスはサインインを拒否する
      return Boolean(member);
    },
    async jwt({ token, account, profile }) {
      const email = profile?.email ?? token.email;
      if (!email) return token;

      const [member] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!member) {
        delete token.member;
        return token;
      }

      // 初回サインイン時、Googleのsub（安定したアカウントID）を紐付けてactiveにする
      if (account?.providerAccountId && (!member.authUserId || member.status === "invited")) {
        await db
          .update(users)
          .set({ authUserId: account.providerAccountId, status: "active" })
          .where(eq(users.id, member.id));
        member.authUserId = account.providerAccountId;
        member.status = "active";
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

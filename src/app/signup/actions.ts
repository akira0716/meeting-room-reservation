"use server";

import { cookies } from "next/headers";
import { signIn } from "@/auth";
import {
  OWNER_SIGNUP_MAX_AGE_SECONDS,
  OWNER_SIGNUP_ORG_NAME_COOKIE,
} from "@/lib/auth/ownerSignup";

/**
 * 組織名をCookieに一時保存してからGoogleサインインへ進む。
 * 実際の組織・管理者ユーザー作成は、サインイン完了後にauth.tsのjwt()コールバックで行う
 * （その時点で初めて本人のメールアドレスが確定するため）。
 */
export async function startOwnerSignup(formData: FormData) {
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  if (!organizationName) {
    throw new Error("組織名を入力してください");
  }

  const cookieStore = await cookies();
  cookieStore.set(OWNER_SIGNUP_ORG_NAME_COOKIE, organizationName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OWNER_SIGNUP_MAX_AGE_SECONDS,
  });

  await signIn("google", { redirectTo: "/" });
}

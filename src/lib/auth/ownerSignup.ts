/**
 * オーナーによる新規組織作成（自己サインアップ）で使うCookie名。
 *
 * /signupで組織名を入力→Googleサインインへ進む際、まだ本人のメールアドレスが
 * 分からないため組織はまだ作れない。そこで組織名をこのCookieに一時保存しておき、
 * Auth.jsのsignIn/jwtコールバック（src/auth.ts）でGoogleサインインが完了した
 * 直後に読み出して、そのタイミングで組織・管理者ユーザーを作成する。
 */
export const OWNER_SIGNUP_ORG_NAME_COOKIE = "owner_signup_org_name";

/** Cookieの有効期間（秒）。Google側の同意画面操作に十分な時間を確保しつつ、使い回されないよう短めにする */
export const OWNER_SIGNUP_MAX_AGE_SECONDS = 60 * 10;

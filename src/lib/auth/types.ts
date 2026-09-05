/**
 * 組織メンバーとしての情報。Supabase Auth時代のOrgMember型を踏襲している。
 * users テーブルの1行にそのまま対応する。
 */
export type OrgMember = {
  id: string;
  organizationId: string;
  email: string;
  name: string | null;
  role: "admin" | "member";
  status: "invited" | "active";
};

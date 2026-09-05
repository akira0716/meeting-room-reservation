import type { OrgMember } from "@/lib/auth/types";

// next-auth/@auth-coreの型は "next-auth" ではなく "@auth/core/*" 側に実体があるため、
// そちらをaugmentしないとcallbacks内の型と一致しない。
declare module "@auth/core/types" {
  interface Session {
    /** 組織メンバーとしてのrole・organizationId等。招待されていないメールなら null */
    member: OrgMember | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    member?: OrgMember | null;
  }
}

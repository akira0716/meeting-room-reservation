import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { AdminNav } from "@/components/AdminNav";
import { CreateInvitationForm } from "@/components/CreateInvitationForm";

const roleLabel: Record<string, string> = { admin: "管理者", member: "一般メンバー" };
const statusLabel: Record<string, string> = { active: "参加済み", invited: "招待中" };

export const dynamic = "force-dynamic";

export default async function AdminInvitationsPage() {
  const { authUser, member } = await getAuthContext();

  if (!authUser) {
    redirect("/login?next=/admin/invitations");
  }
  if (!member || member.role !== "admin") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-8">
        <p className="text-sm text-rose-600 dark:text-rose-400">
          このページは管理者のみ利用できます。
        </p>
      </main>
    );
  }

  const members = await db
    .select()
    .from(users)
    .where(eq(users.organizationId, member.organizationId));

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <AdminNav current="/admin/invitations" />
      <h1 className="mt-4 text-xl font-semibold">メンバー招待</h1>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-neutral-500">新しいメンバーを招待</h2>
        <div className="mt-2">
          <CreateInvitationForm />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-500">メンバー一覧</h2>
        <ul className="mt-2 divide-y divide-black/5 dark:divide-white/5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span>{m.email}</span>
              <span className="flex gap-2 text-xs text-neutral-500">
                <span>{roleLabel[m.role]}</span>
                <span>・</span>
                <span>{statusLabel[m.status]}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

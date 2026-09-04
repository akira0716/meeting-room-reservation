import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { invitations, organizations } from "@/lib/db/schema";
import { AcceptInviteButton } from "@/components/AcceptInviteButton";

const roleLabel: Record<string, string> = {
  admin: "管理者",
  member: "一般メンバー",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);

  if (!invitation) {
    return (
      <main className="mx-auto max-w-sm px-6 py-16">
        <p className="text-sm text-rose-600 dark:text-rose-400">
          招待リンクが見つかりません。URLが正しいかご確認ください。
        </p>
      </main>
    );
  }

  if (invitation.acceptedAt) {
    return (
      <main className="mx-auto max-w-sm px-6 py-16">
        <p className="text-sm text-neutral-500">この招待はすでに承諾済みです。</p>
      </main>
    );
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <main className="mx-auto max-w-sm px-6 py-16">
        <p className="text-sm text-rose-600 dark:text-rose-400">この招待リンクは有効期限が切れています。</p>
      </main>
    );
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, invitation.organizationId))
    .limit(1);

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-lg font-semibold">{org?.name ?? "組織"}への招待</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {invitation.email}（{roleLabel[invitation.role]}）として招待されています。
      </p>
      <div className="mt-4">
        <AcceptInviteButton email={invitation.email} token={token} />
      </div>
    </main>
  );
}

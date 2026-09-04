import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { SetPasswordForm } from "@/components/SetPasswordForm";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const { authUser } = await getAuthContext();

  if (!authUser) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-lg font-semibold">パスワードの設定</h1>
      <p className="mt-1 text-sm text-neutral-500">
        次回以降は、このパスワードでサインインできます。
      </p>
      <div className="mt-4">
        <SetPasswordForm next={next ?? "/"} />
      </div>
    </main>
  );
}

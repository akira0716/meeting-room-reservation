import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-lg font-semibold">サインイン</h1>
      <p className="mt-1 text-sm text-neutral-500">
        組織に招待されているメールアドレスを入力してください。
      </p>
      <div className="mt-4">
        <LoginForm next={next} />
      </div>
    </main>
  );
}

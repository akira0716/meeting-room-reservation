import { signInWithGoogle } from "./actions";

const errorMessages: Record<string, string> = {
  AccessDenied:
    "このメールアドレスはまだ招待されていません。管理者に招待を依頼してください。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-lg font-semibold">サインイン</h1>
      <p className="mt-1 text-sm text-neutral-500">
        組織に招待されているGoogleアカウントでサインインしてください。
      </p>
      {error && (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {errorMessages[error] ?? "サインインに失敗しました。時間をおいて再度お試しください。"}
        </p>
      )}
      <form action={signInWithGoogle} className="mt-4">
        <input type="hidden" name="next" value={next ?? "/"} />
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Googleでサインイン
        </button>
      </form>
      <a
        href="/signup"
        className="mt-4 block text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        組織のオーナーとして新しく始める方はこちら
      </a>
    </main>
  );
}

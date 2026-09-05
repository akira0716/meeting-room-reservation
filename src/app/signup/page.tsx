import { startOwnerSignup } from "./actions";

const errorMessages: Record<string, string> = {
  AlreadyMember:
    "このGoogleアカウントは既に別の組織に参加しています。1つのアカウントにつき1つの組織にのみ参加できます。別のGoogleアカウントでお試しください。",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-lg font-semibold">組織を新しく始める</h1>
      <p className="mt-1 text-sm text-neutral-500">
        あなたが組織のオーナー（管理者）として登録されます。建物やフロアの登録は、
        サインイン後の画面から行います。
      </p>
      {error && (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {errorMessages[error] ?? "登録に失敗しました。時間をおいて再度お試しください。"}
        </p>
      )}
      <form action={startOwnerSignup} className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-neutral-500">組織名</label>
          <input
            type="text"
            name="organizationName"
            required
            placeholder="株式会社サンプル"
            className="mt-0.5 w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Googleでサインアップ
        </button>
      </form>
      <a
        href="/login"
        className="mt-4 block text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        既存の組織にサインインする方はこちら
      </a>
    </main>
  );
}

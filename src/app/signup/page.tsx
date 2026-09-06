import { AuthScreen } from "@/components/AuthScreen";
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
    <AuthScreen
      title="組織を新しく始める"
      lead="あなたが組織のオーナー（管理者）として登録されます。建物やフロアの登録は、サインイン後の画面から行います。"
      error={
        error ? (errorMessages[error] ?? "登録に失敗しました。時間をおいて再度お試しください。") : undefined
      }
      switchHref="/login"
      switchLabel="既存の組織にサインインする方はこちら"
    >
      <form action={startOwnerSignup} className="space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-neutral-500">組織名</label>
          <input
            type="text"
            name="organizationName"
            required
            placeholder="株式会社サンプル"
            className="mt-1.5 w-full rounded-[9px] border border-neutral-200 bg-neutral-50 px-[13px] py-[11px] text-sm text-neutral-900 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-50"
          />
        </div>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-emerald-700 px-[18px] py-[13px] text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Googleでサインアップ
        </button>
      </form>
      <p className="mt-3.5 text-xs leading-[1.8] text-neutral-500">
        Googleの認証画面に移動します。パスワードの登録は不要です。
      </p>
    </AuthScreen>
  );
}

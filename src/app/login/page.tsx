import { AuthScreen } from "@/components/AuthScreen";
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
    <AuthScreen
      title="サインイン"
      lead="組織に招待されているGoogleアカウントでサインインしてください。"
      error={
        error
          ? (errorMessages[error] ?? "サインインに失敗しました。時間をおいて再度お試しください。")
          : undefined
      }
      switchHref="/signup"
      switchLabel="組織のオーナーとして新しく始める方はこちら"
    >
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? "/"} />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-emerald-700 px-[18px] py-[13px] text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Googleでサインイン
        </button>
      </form>
      <p className="mt-3.5 text-xs leading-[1.8] text-neutral-500">
        Googleの認証画面に移動します。パスワードの登録は不要です。
      </p>
    </AuthScreen>
  );
}

import Link from "next/link";
import { FloorMapView } from "@/components/FloorMapView";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { getFloorMapData } from "@/lib/queries/getFloorMapData";

export const dynamic = "force-dynamic"; // 「今使用中か」やセッション状態を毎回サーバーで判定するため

export default async function Home() {
  const { authUser, member } = await getAuthContext();

  // 【認証は設計をやり直すため一時的に無効化中】本来はここで !authUser なら /login へredirectしていた。
  // 今はgetAuthContext()が常にシード済み管理者を返すためauthUserがnullになることはないが、
  // 万一usersテーブルに管理者が1件もない場合はこのメッセージを出す。
  if (!authUser) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <p className="text-sm text-neutral-500">
          管理者ユーザーが見つかりません。<code>npm run auth:seed-admins</code> を実行してください。
        </p>
      </main>
    );
  }
  if (!member) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <p className="text-sm text-neutral-500">
          {authUser.email} はどの組織にも招待されていません。管理者に招待を依頼してください。
        </p>
      </main>
    );
  }

  const data = await getFloorMapData();

  if (!data) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm text-neutral-500">
          データがありません。<code>npm run db:seed</code> を実行してダミーデータを投入してください。
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{data.buildingName} 会議室マップ</h1>
          <p className="text-sm text-neutral-500">{data.organizationName}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400">{member.email}</span>
          {member.role === "admin" && (
            <Link
              href="/admin/invitations"
              className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              メンバー招待
            </Link>
          )}
        </div>
      </header>
      <FloorMapView data={data} isAdmin={member.role === "admin"} />
    </main>
  );
}

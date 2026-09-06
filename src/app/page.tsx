import { AppHeader } from "@/components/AppHeader";
import { CreateFirstBuildingForm } from "@/components/CreateFirstBuildingForm";
import { DateNav } from "@/components/DateNav";
import { FloorMapView } from "@/components/FloorMapView";
import { LandingPage } from "@/components/LandingPage";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { parseDateKey } from "@/lib/dateKey";
import { getFloorMapData } from "@/lib/queries/getFloorMapData";

export const dynamic = "force-dynamic"; // 「今使用中か」やセッション状態を毎回サーバーで判定するため

/**
 * "?date=YYYY-MM-DD"を解釈する。無指定・不正な値なら今日にフォールバックする。
 */
function resolveSelectedDate(dateParam: string | undefined): Date {
  if (dateParam) {
    const parsed = parseDateKey(dateParam);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const { authUser, member } = await getAuthContext();

  // 未サインインの訪問者には、サインインを要求する代わりにLP（ランディングページ）を表示する
  if (!authUser) {
    return <LandingPage />;
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

  const selectedDate = resolveSelectedDate(dateParam);
  const data = await getFloorMapData(member.organizationId, selectedDate);

  if (!data) {
    if (member.role !== "admin") {
      return (
        <main className="mx-auto max-w-md px-6 py-16">
          <p className="text-sm text-neutral-500">
            組織の設定がまだ完了していません。管理者が建物・フロアを登録するまでお待ちください。
          </p>
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-sm px-6 py-16">
        <h1 className="text-lg font-semibold">最初の建物・フロアを登録</h1>
        <p className="mt-1 text-sm text-neutral-500">
          会議室の追加はまだUIから行えません（近日対応予定）。まずは建物・フロアを登録してください。
        </p>
        <CreateFirstBuildingForm />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <AppHeader
        title={`${data.buildingName} 会議室マップ`}
        subtitle={data.organizationName}
        isAdmin={member.role === "admin"}
        currentPath="/"
        accountEmail={member.email}
        accountName={member.name}
        accountImage={authUser.image}
      />
      <div className="mb-4">
        <DateNav dateKey={data.date} isToday={data.isToday} />
      </div>
      <FloorMapView
        data={data}
        isAdmin={member.role === "admin"}
        currentMemberId={member.id}
      />
    </main>
  );
}

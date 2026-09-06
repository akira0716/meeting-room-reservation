import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { CalendarGrid } from "@/components/CalendarGrid";
import { MonthNav } from "@/components/MonthNav";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { parseMonthKey, toMonthKey } from "@/lib/dateKey";
import { getCalendarMonthData } from "@/lib/queries/getCalendarMonthData";

export const dynamic = "force-dynamic";

/** "?month=YYYY-MM"を解釈する。無指定・不正な値なら今月にフォールバックする */
function resolveSelectedMonthKey(monthParam: string | undefined): string {
  if (monthParam) {
    const parsed = parseMonthKey(monthParam);
    if (!Number.isNaN(parsed.getTime())) return monthParam;
  }
  return toMonthKey(new Date());
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const { authUser, member } = await getAuthContext();

  if (!authUser) {
    redirect("/login?next=/calendar");
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

  const monthKey = resolveSelectedMonthKey(monthParam);
  const data = await getCalendarMonthData(member.organizationId, monthKey);

  if (!data) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <p className="text-sm text-neutral-500">
          組織の設定がまだ完了していません。管理者が建物・フロアを登録するまでお待ちください。
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <AppHeader
        title="カレンダー"
        subtitle={`${data.buildingName}・${data.organizationName}`}
        isAdmin={member.role === "admin"}
        currentPath="/calendar"
        accountEmail={member.email}
        accountName={member.name}
        accountImage={authUser.image}
      />
      <div className="mb-4">
        <MonthNav monthKey={data.monthKey} />
      </div>
      {/* 月を切り替えても選択中の日付（内部state）がリセットされず前月の日付を
          保持し続けてしまうため、monthKeyをkeyにして月が変わるたびに作り直す */}
      <CalendarGrid
        key={data.monthKey}
        monthKey={data.monthKey}
        reservations={data.reservations}
        currentMemberId={member.id}
      />
    </main>
  );
}

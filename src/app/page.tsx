import { FloorMapView } from "@/components/FloorMapView";
import { getFloorMapData } from "@/lib/queries/getFloorMapData";

export const dynamic = "force-dynamic"; // 「今使用中か」を毎回サーバーで判定するため

export default async function Home() {
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
      <header className="mb-6">
        <h1 className="text-xl font-semibold">{data.buildingName} 会議室マップ</h1>
        <p className="text-sm text-neutral-500">{data.organizationName}</p>
      </header>
      <FloorMapView data={data} />
    </main>
  );
}

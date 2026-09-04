/**
 * フロア図画像を保存するSupabase Storageバケットを作成する。
 * バケットのメタデータはPostgresのstorage.buckets テーブルにあるため、DATABASE_URL経由で直接作成できる
 * （Supabaseダッシュボードでの手動作成の代わり）。
 *
 * 実行: npm run storage:setup
 */
import postgres from "postgres";

const BUCKET_ID = "floor-plans";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(connectionString, { prepare: false });

  await sql`
    INSERT INTO storage.buckets (id, name, public)
    VALUES (${BUCKET_ID}, ${BUCKET_ID}, true)
    ON CONFLICT (id) DO NOTHING
  `;

  console.log(`Storageバケット "${BUCKET_ID}" を作成しました（既に存在する場合はスキップ）`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

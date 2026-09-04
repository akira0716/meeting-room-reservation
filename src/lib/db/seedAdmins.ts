/**
 * config/seed-admins.json に列挙された組織・メールアドレスを初期管理者として登録する。
 * 「最初の管理者を誰が招待するか」という鶏卵問題を、コード外のconfigファイルで解決する。
 *
 * 実行: npm run auth:seed-admins
 * 冪等：既に存在するユーザーはrole=adminに揃えるだけで、authUserIdやstatusは上書きしない
 * （一度サインインしてactiveになっている場合、そのリンクを壊さないため）。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { organizations, users } from "./schema";

type SeedAdminEntry = { organizationName: string; email: string };

async function main() {
  const configPath = join(process.cwd(), "config", "seed-admins.json");
  const entries: SeedAdminEntry[] = JSON.parse(readFileSync(configPath, "utf-8"));

  for (const entry of entries) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.name, entry.organizationName))
      .limit(1);

    if (!org) {
      console.warn(`組織が見つかりません（スキップ）: ${entry.organizationName}`);
      continue;
    }

    await db
      .insert(users)
      .values({
        organizationId: org.id,
        email: entry.email,
        role: "admin",
        status: "active",
      })
      .onConflictDoUpdate({
        target: [users.organizationId, users.email],
        set: { role: "admin" },
      });

    console.log(`管理者を登録しました: ${entry.email} @ ${entry.organizationName}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit());

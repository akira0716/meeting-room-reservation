import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. .env.exampleを参考に.envを作成してください。");
}

// SupabaseのPgBouncer(トランザクションモード)経由で使う場合はprepared statementを無効化する
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });

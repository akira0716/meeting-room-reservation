import { createClient } from "@supabase/supabase-js";

const FLOOR_PLANS_BUCKET = "floor-plans";

/**
 * クライアント/サーバーどちらからも安全に使える公開情報のみのクライアント。
 * publishable keyは公開情報として扱ってよい（旧anon key相当）。
 */
function getPublicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set.");
  }
  return createClient(url, publishableKey, { auth: { persistSession: false } });
}

export function getFloorPlanImageUrl(path: string): string {
  const { data } = getPublicSupabaseClient().storage.from(FLOOR_PLANS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

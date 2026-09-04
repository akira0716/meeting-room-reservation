import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/serverAuthClient";

/**
 * マジックリンクのクリック後に戻ってくるコールバック。
 * Supabaseが付与した`code`をセッションに交換し、`next`（省略時は"/"）へリダイレクトする。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseAuthServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

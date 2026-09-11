import { createSupabaseServerClient } from "./serverClient";
import { floorMapChannelName, FLOOR_MAP_CHANGED_EVENT } from "./realtimeChannels";

/**
 * 予約・会議室配置の変更を、同じ組織の他の利用者が開いているフロアマップへ
 * Supabase Realtime（Broadcast）で知らせる。REST経由（httpSend）で送るため、
 * WebSocket接続の確立や事前のsubscribe()は不要（Server Actionのような
 * 短命な実行環境から呼ぶのに適している）。
 *
 * ベストエフォート：送信に失敗しても（Realtimeが一時的に落ちている等）、呼び出し元の
 * 予約操作自体は既にDBへのコミットが済んでいるため、エラーはログのみに留めて
 * 呼び出し元の処理（レスポンス）には影響させない。
 */
export async function broadcastFloorMapChange(organizationId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const channel = supabase.channel(floorMapChannelName(organizationId));
  try {
    await channel.httpSend(FLOOR_MAP_CHANGED_EVENT, {});
  } catch (err) {
    console.error("フロアマップ変更のリアルタイム通知に失敗しました:", err);
  } finally {
    // REST送信専用に作ったチャンネルなので、送信が終わったら解放する
    // （Supabase公式ドキュメントの推奨に従う）
    supabase.removeChannel(channel);
  }
}

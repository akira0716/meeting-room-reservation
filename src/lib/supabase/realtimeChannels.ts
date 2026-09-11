/**
 * フロアマップのリアルタイム反映（Supabase Realtime の Broadcast機能）で、
 * サーバー側（送信）とクライアント側（受信）の両方が同じチャンネル名・イベント名を
 * 参照するための共有定義。DBやReactに依存しないため、送受信どちらからもimportできる。
 *
 * 設計方針：
 * - チャンネルは組織単位（日付・フロア単位ではない）にしている。フロアマップは
 *   組織内の全フロア・全会議室の当日データを1回のクエリでまとめて取得しており
 *   （getFloorMapData参照）、フロアタブの切り替えはクライアント側の表示切り替えのみ
 *   （再取得しない）ため、日付・フロアで分けても実際の再取得単位とずれてしまう。
 *   別の日付を見ている利用者にも通知が届くが、router.refresh()は現在表示中の日付で
 *   再取得するだけなので、無関係な変更で多少無駄なリフレッシュが起きても実害は無い
 *   （小規模な組織利用を想定したこのアプリの規模であれば許容範囲と判断した）
 * - ブロードキャストの中身（payload）は持たせず、「何かが変わった」という合図のみに
 *   する。実データは必ずNext.js側（router.refresh）から組織スコープ済みのサーバー
 *   データとして取り直させる。チャンネル名（組織ID）が万一推測されても、流れる
 *   情報が「変更があった」という事実だけなので実害を最小限にできる
 * - Postgres Changes（テーブルのレプリケーションをSupabase側で有効化する方式）ではなく
 *   Broadcastを使っているのは、このアプリの認可がSupabase Auth（RLS）ではなく
 *   Auth.js＋自前のusersテーブルで完結しており、RLSでの組織スコープ制御と相性が
 *   悪いため。Broadcastならアプリのサーバー側（Server Action）が明示的に送信元と
 *   なるので、既存の組織所有チェックをそのまま活かせる
 */
export function floorMapChannelName(organizationId: string): string {
  return `floor-map:${organizationId}`;
}

/** フロアマップに変更があったことを知らせるBroadcastイベント名 */
export const FLOOR_MAP_CHANGED_EVENT = "changed";

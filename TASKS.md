# TASKS

現状の実装済み範囲は[README.md](./README.md)を参照。ここには残っているスコープを優先度別に記録する。

## 優先度：高

### デプロイ（ポートフォリオとして公開するために必須）
- [ ] Vercelへデプロイ
- [ ] 環境変数（`DATABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`）をVercel側に設定
- [ ] デプロイ後の動作確認（フロアマップ表示・予約作成・重複エラー）

### 認証・認可（設計は[README.md](./README.md#3-設計判断)で整理済み。上流設計の見せ場として実装したい）
- [ ] Supabase Authのセットアップ（マジックリンク／メールOTP）
- [ ] 招待（`Invitation`）発行API・管理ページ（管理者が招待メールアドレス＋roleを指定）
- [ ] 招待リンク経由のサインアップ・組織参加フロー（`User`をinvited→activeに更新）
- [ ] 初期管理者のconfigファイルシード実装（`config/seed-admins.json`想定）
- [ ] admin/member権限に応じたAPIの認可チェック（部屋の作成・編集はadminのみ等）
- [ ] **`/api/floors/[floorId]/image`（フロア図アップロード）を管理者のみ呼べるように制限する**（認証実装までの暫定として現状は無制限に呼び出せる）

## 優先度：中

### 予約編集・楽観ロックUI
- [ ] 予約編集フォーム（時間・タイトル変更）。`reservationService.updateReservation`は実装・テスト済みなのでUIを繋ぐだけ
- [ ] 楽観ロック競合時のUI（「他のユーザーによって更新されています」の表示＋再読み込み導線）
- [ ] 予約削除機能

### フロア図（背景画像）編集画面
- [x] `floors`テーブルに`floorPlanImagePath`/`Width`/`Height`を追加、Supabase Storage（`floor-plans`バケット）連携
- [x] フロア図アップロードAPI（`/api/floors/[floorId]/image`）と暫定アップロードUI
- [x] フロアマップSVGの背景に画像を表示（座標系を画像ピクセルサイズに合わせる）
- [ ] 会議室をドラッグして配置・リサイズできる編集画面（現状は座標をDBに直接投入するのみ）
- [ ] 新規会議室の追加・削除をUIから行えるようにする

## 優先度：低（余力があれば）

- [ ] 実DB（Supabase）を使った結合テスト（Vitest導入計画のステップ4）

## スコープ外（README「今後の展望」・stretch goals）

- [ ] Google Calendar APIとの実連携（読み取り／書き込み）
- [ ] 招待トークンの有効期限切れ・再送フロー
- [ ] 部屋・機能単位のより細かい権限設定

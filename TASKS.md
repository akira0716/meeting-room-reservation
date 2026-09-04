# TASKS

現状の実装済み範囲は[README.md](./README.md)を参照。ここには残っているスコープを優先度別に記録する。

## 優先度：高

### デプロイ（ポートフォリオとして公開するために必須）
- [x] Vercelへデプロイ：https://meeting-room-reservation-theta.vercel.app/login
- [x] 環境変数（`DATABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`）をVercel側に設定
- [x] デプロイ後の動作確認（サインイン→フロアマップ表示まで確認済み）
- [x] `@types/node`のバージョン不整合でVercelビルドが失敗する問題を修正（ローカルの`--legacy-peer-deps`頼みだった箇所を根本修正）

### 認証・認可（設計は[README.md](./README.md#3-設計判断)で整理済み。上流設計の見せ場として実装した）
- [x] Supabase Authのセットアップ（初回：マジックリンク→パスワード設定／2回目以降：メール+パスワード）
- [x] 招待（`Invitation`）発行API・管理ページ（`/admin/invitations`、管理者が招待メールアドレス＋roleを指定）
- [x] 招待リンク経由のサインアップ・組織参加フロー（`/invite/[token]` → マジックリンク → `/set-password`）
- [x] 初期管理者のconfigファイルシード実装（`config/seed-admins.json` + `npm run auth:seed-admins`）
- [x] admin/member権限に応じたAPIの認可チェック（フロア図アップロードは管理者のみ、予約作成はサインイン済み組織メンバーのみ）
- [ ] パスワード再設定（forgot password）専用の導線・文言（現状は「初めての方はこちら」と共用）
- [ ] Supabaseのメール送信レート制限（無料枠は非常に少なく、開発中に実際に上限に達した）対策。カスタムSMTP設定、またはUIに分かりやすい案内を追加
- [ ] 招待URLをメールで自動送信する（現状は管理画面にURLを表示するだけで、Slack等での手動共有を想定した設計のまま）

## 優先度：中

### 予約編集・楽観ロックUI
- [x] 予約編集フォーム（会議名・予約者名・時間の変更）
- [x] 楽観ロック競合時のUI（「他のユーザーによって更新されています」の表示＋「最新の内容を読み込み直す」導線）。ブラウザ+DB直接操作で競合を再現し実機確認済み
- [x] 予約削除機能（楽観ロック付き、2段階確認UI）

### フロア図（背景画像）編集画面
- [x] `floors`テーブルに`floorPlanImagePath`/`Width`/`Height`を追加、Supabase Storage（`floor-plans`バケット）連携
- [x] フロア図アップロードAPI（`/api/floors/[floorId]/image`）と暫定アップロードUI
- [x] フロアマップSVGの背景に画像を表示（座標系を画像ピクセルサイズに合わせる）
- [x] 会議室をドラッグして配置できる編集画面（管理者向け「編集モード」トグル、フロアマップ画面に統合）。ドラッグ位置はローカルに保持し「保存」ボタンでまとめて反映する方式。実機確認済み
- [ ] リサイズ機能（現状は移動のみ。サイズ変更は次のステップ）
- [ ] 新規会議室の追加・削除をUIから行えるようにする

## 優先度：低（余力があれば）

- [ ] 実DB（Supabase）を使った結合テスト（Vitest導入計画のステップ4）

## スコープ外（README「今後の展望」・stretch goals）

- [ ] Google Calendar APIとの実連携（読み取り／書き込み）
- [ ] 招待トークンの有効期限切れ・再送フロー
- [ ] 部屋・機能単位のより細かい権限設定

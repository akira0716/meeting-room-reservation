# TASKS

現状の実装済み範囲は[README.md](./README.md)を参照。ここには残っているスコープを優先度別に記録する。

## 優先度：高

### デプロイ（ポートフォリオとして公開するために必須）
- [x] Vercelへデプロイ：https://meeting-room-reservation-theta.vercel.app/login
- [x] 環境変数（`DATABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`）をVercel側に設定
- [x] デプロイ後の動作確認（サインイン→フロアマップ表示まで確認済み）
- [x] `@types/node`のバージョン不整合でVercelビルドが失敗する問題を修正（ローカルの`--legacy-peer-deps`頼みだった箇所を根本修正）

### 認証・認可（設計は[README.md](./README.md#3-設計判断)で整理済み。上流設計の見せ場として実装した）
- [x] **Auth.js（Google OAuthのみ）へ移行完了**：`feature/authjs-google-auth`ブランチで実装。Supabase Auth（メール+パスワード／Google OAuth移行）は2回とも設定依存・原因不明の不具合で頓挫したため、認証をAuth.jsに切り出し、認可（role・organization）は自前の`users`テーブルにそのまま残す構成に変更した（詳細はREADMEの「設計判断の経緯」を参照）
  - [x] `src/auth.ts`（Auth.js設定、Google Provider、JWTセッション、`signIn`/`jwt`/`session`コールバックで`users`テーブルと突き合わせ）
  - [x] `getAuthContext()`をAuth.jsの`auth()`ベースに書き換え（呼び出し側のインターフェースは維持、無改修で動作）
  - [x] 招待＝`users`テーブルへの許可リスト登録のみに簡略化（メール送信は行わない。本人はURLを伝えられて「Googleでサインイン」を押すだけ）
  - [x] 旧Supabase Auth関連コード（`/login`のパスワードフォーム、`/set-password`、`/auth/callback`、`browserClient.ts`/`serverAuthClient.ts`、`proxy.ts`）を削除
  - [ ] ローカル・本番それぞれでGoogle Cloud ConsoleのリダイレクトURI登録・`.env`のAuth.js関連値設定・実機での動作確認（**ここまでは未実施、次にやること**）
  - [ ] admin/invitations画面の「メンバー一覧」に表示している`status`の文言・運用フローが「メール招待」前提のままの箇所がないか最終確認
- [ ] （保留）Google以外のサインイン手段（フォールバック）。まずはGoogleのみで安定動作を確認してから要否を判断する

<details>
<summary>旧実装（Supabase Auth、履歴として保持）</summary>

- [x] Supabase Authのセットアップ（初回：メールリンク→パスワード設定／2回目以降：メール+パスワード）
- [x] 招待発行API・管理ページ（`/admin/invitations`、管理者が招待メールアドレス＋roleを指定）
- [x] 招待メールの自動送信（`auth.admin.inviteUserByEmail`）。旧・自前トークン方式(`/invite/[token]`)は廃止し、`invitations`テーブルも削除
- [x] 招待メール経由のサインイン・組織参加フロー（メールのリンク→`/auth/callback`→`getAuthContext()`が自動でusers行に紐付け→`/set-password`）
- [x] admin/member権限に応じたAPIの認可チェック（フロア図アップロードは管理者のみ、予約作成はサインイン済み組織メンバーのみ）
- [x] **バグ修正**：Supabase管理API発行リンクの認証情報がURLハッシュで返る問題。`/auth/callback`をサーバーRoute Handler→クライアントページに書き換えて対応
- [x] **要設定**：SupabaseダッシュボードのRedirect URLsが未設定だとサインインが失敗する問題に気づき、READMEのセットアップ手順に追記
- 未解決のまま終了：パスワード再設定専用の導線、Supabaseのメール送信レート制限対策、Google OAuth移行時のPKCE code verifier不具合

</details>

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
- [ ] 部屋・機能単位のより細かい権限設定

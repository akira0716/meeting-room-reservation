# TASKS

現状の実装済み範囲は[README.md](./README.md)を参照。ここには残っているスコープを優先度別に記録する。

## 優先度：高

### セキュリティ（マルチテナント化に伴い発見）
- [ ] `createReservationAction`/`updateReservationAction`/`deleteReservationAction`（[actions.ts](./src/app/actions.ts)）が、対象の会議室・予約が操作者の所属組織のものかを検証していない。組織が1つしかなかった頃は問題が表面化しなかったが、複数組織が存在する今は、他組織のroomId/予約IDを直接指定されると操作できてしまう可能性がある。`saveFloorLayoutAction`・フロア図アップロードAPIと同じ「組織所有チェック」パターンを追加する必要がある

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
  - [x] ローカルでGoogle Cloud ConsoleのリダイレクトURI登録・`.env`のAuth.js関連値設定・実機での動作確認（サインイン→フロアマップ表示まで確認済み）
  - [x] **バグ修正**：`users.authUserId`が`uuid`型のままだったため、Googleの`sub`（数値文字列、UUID形式ではない）を書き込もうとしてPostgresエラーになりサインインが失敗する問題。`text`型に変更して解決（[schema.ts](./src/lib/db/schema.ts)）
  - [x] **要設定**：Google Cloud ConsoleのOAuth同意画面が「テスト」公開ステータスのままだと、テストユーザー未登録のGoogleアカウントは同意画面で401になり弾かれる問題に気づき、「本番」公開ステータスに変更して解決（スコープがemail/profile/openidのみのため審査不要）
  - 招待フローの改善案（ログインURLのコピーボタン、複数メールアドレスの一括招待）は一度実装したが、ログインURLはアプリのURLと同じで招待ごとに変わらないため「コピー機能」自体が不要と判断し撤回。一括登録も現時点では不要と判断し、1件ずつの入力に戻した
- [x] 本番（Vercel）側でのGoogle Cloud ConsoleリダイレクトURI登録・環境変数設定・動作確認まで完了
- [ ] （保留）Google以外のサインイン手段（フォールバック）。まずはGoogleのみで安定動作を確認してから要否を判断する

### 組織のセルフサインアップ（`feature/owner-signup`ブランチで実装。管理者を増やすたびに再デプロイが必要なconfigシード方式の限界に対応）
- [x] **重大バグ修正**：`getFloorMapData()`が「DB内の先頭の組織」を無条件に採用していた問題。組織が1つしかない前提が崩れる（＝2つ目の組織がサインアップした瞬間に他組織のデータが見えてしまう）ため、ログイン中メンバーの`organizationId`で必ず絞り込むよう修正（[getFloorMapData.ts](./src/lib/queries/getFloorMapData.ts)）
- [x] `/signup`：組織名を入力→「Googleでサインアップ」。組織名は短命Cookie（[ownerSignup.ts](./src/lib/auth/ownerSignup.ts)）でGoogle OAuthの往復を橋渡しし、サインイン完了時（`auth.ts`の`jwt`コールバック）に`organizations`行・`users`行（role: admin）を作成する
- [x] オンボーディング画面：組織に建物が1つも無い状態でログインすると、管理者には「最初の建物・フロアを登録」フォーム（[CreateFirstBuildingForm.tsx](./src/components/CreateFirstBuildingForm.tsx)）、一般メンバーには「管理者の設定待ち」メッセージを表示
- [x] **バグ修正**：`/signup`で既に別組織に所属（招待中も含む）済みのメールアドレスを使うと、新規組織作成の意図を無視して既存組織にログインしてしまう問題。「1アカウント=1組織」の設計を明確化し、既存メンバーなら`/signup?error=AlreadyMember`へリダイレクトして拒否するよう修正（`signIn`コールバックの判定順序の問題だった）
- [ ] 会議室（room）自体の追加UIは別タスク（「新規会議室の追加・削除をUIから行えるようにする」）のまま。オンボーディング直後は建物・フロアはあっても部屋が無い状態になる
- 既存の`config/seed-admins.json`によるconfigシード方式は、最初のデモ組織の管理者ブートストラップとして引き続き利用可能（廃止していない）

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
- [x] **会議室の追加・削除UI**（`feature/room-management`ブランチ）：編集モードに「＋ 会議室を追加」ボタンを追加し、名前・定員を入力してドラッグ配置、既存の会議室は右上の「×」で削除予定にできる（元に戻す可）。すべて既存の「保存」ボタンでの一括反映方式に統合し、`updateRoomPositionsAction`を`saveFloorLayoutAction`に拡張（移動・追加・削除をまとめて1トランザクションで処理）
  - あわせて**セキュリティ修正**：このアクションが対象フロア・会議室が操作者の所属組織のものかを検証していなかった（マルチテナント化前は組織が1つしかなく問題が表面化しなかった）。フロア図アップロードAPIと同じ「組織所有チェック」パターンを追加した
- [x] **リサイズ機能**（`feature/room-resize`ブランチ）：会議室の右下角に■ハンドルを追加し、ドラッグで幅・高さを変更できるようにした（左上位置は固定、最小サイズでクランプ）。移動・追加・削除と同様、既存の「保存」ボタンでの一括反映方式に統合（`RoomPositionUpdate`にwidth/heightを追加、サーバー側でも最小サイズをクランプ）。実機確認済み
  - **バグ修正**：保存前（編集中）はviewBoxがサーバー保存済みデータのみを見て計算されていたため、大きくリサイズした際にキャンバスが追従せず見た目のサイズが不正確になる問題があった。displayRooms（編集中の状態を反映済み）を基準に計算するよう修正
- [x] **表示方式の見直し**：フロア図画像があるフロアは、画像を拡大縮小せず実ピクセルサイズのまま表示し、はみ出す分はスクロールする方式に変更（`overflow-auto`のコンテナ＋width/heightを画像サイズに固定したsvg）。画像が無いフロアは、従来どおり表示エリア自体を1フロア分としてaspect-ratio固定のコンテナ内で拡大縮小表示する。無理に固定比率へ画像を押し込めていたことがこれまでのサイズ不整合の根本原因だったため、この使い分けで解消した

## 優先度：低（余力があれば）

- [ ] 実DB（Supabase）を使った結合テスト（Vitest導入計画のステップ4）

## スコープ外（README「今後の展望」・stretch goals）

- [ ] Google Calendar APIとの実連携（読み取り／書き込み）
- [ ] 部屋・機能単位のより細かい権限設定

# フロアマップ会議室予約（仮称）

会議室の空き状況を「フロアマップ」上で視覚的に確認しながら、そのまま予約できるWebアプリ。

**デモ**：https://meeting-room-reservation-theta.vercel.app/login （招待制のためサインインには管理者の招待が必要）

## 1. 課題発見の経緯

自社の会議室予約は普段Googleカレンダーで運用しており、空き日時や予約自体には特に不便を感じていない。一方で、**会議室の名前と物理的な位置が視覚的に結びついていない**ため、「〇〇会議室ってどこだっけ」と探すことがある。この不便を解決するために、カレンダーの予約データはそのままに、UI（フロアマップ）だけを追加で提供するアプリとして企画した。

## 2. 要件定義・MVPスコープ

- フロア図（矩形配置）に会議室を表示し、空き/使用中を色分け表示する
- 実際のフロア図（画像）を背景として表示し、入り口や目印からの相対位置を把握しやすくする
- 会議室をクリックすると、当日のタイムスロット別予約状況を確認できる
- 空いている時間帯を選んで、その場で予約を作成できる
- 同じ時間帯への同時予約や、同じ予約への同時編集が競合しないよう制御する
- スコープ外（今後の展望に回す）：実際のGoogle Calendar APIとの連携、部屋配置のドラッグ&ドロップ編集画面

データはポートフォリオ用のダミーデータで完結させる（実在の会社の予約データは使用しない）。

## 3. 設計判断

### 排他制御（楽観ロック）
予約の更新（時間変更など）に`version`カラムを持たせ、更新時に期待していたversionと現在のversionが一致する場合のみ更新を許可する。一致しなければ「他のユーザーが先に更新した」とみなし、競合エラーを返す（[`reservationService.ts`](./src/lib/services/reservationService.ts)）。

新規予約作成時は、既存予約との時間帯重複を業務ロジック側でチェックする（[`reservationOverlap.ts`](./src/lib/services/reservationOverlap.ts)）。

### 外部依存の抽象化
DBアクセスは`ReservationRepository`インターフェース（[`reservationRepository.ts`](./src/lib/repositories/reservationRepository.ts)）越しにのみ行い、サービス層はSupabase/Postgresの実装詳細を知らない。テスト時は`InMemoryReservationRepository`に差し替えることで、実DBなしでビジネスロジックをテストできる。

```
app/api/.../route.ts      … 薄いコントローラ層
lib/services/             … 業務ロジック（重複チェック・楽観ロック）
lib/repositories/         … データアクセス（インターフェース＋実装の分離）
```

### 認証・認可
- 認証はAuth.js（Google OAuthのみ）に任せ、パスワード管理は自前で行わない
- 認証（このアプリを操作しているのがGoogleアカウント本人か）と認可（その人がどの組織のどんなroleか）を明確に分離している
  - 認証：Auth.jsのGoogle Providerがサインインそのものを担当。セッションはJWT戦略（DBアダプタなし）
  - 認可：`users`テーブルを唯一の真実の情報源とし、Auth.jsの`signIn`/`jwt`コールバック（[`auth.ts`](./src/auth.ts)）でメールアドレスを突き合わせる
  - 招待：管理者が管理ページからメールアドレス＋roleを指定すると、`users`テーブルにstatus:"invited"の行を作る（＝許可リストへの登録）。**メールは送信しない**——招待された本人は、伝えられたURLでログイン画面の「Googleでサインイン」を押すだけでよい。`signIn()`コールバックが「そのメールアドレスの`users`行が存在するか」だけを見て可否を決め、初回サインイン時に自動でactiveへ更新する
  - 初期管理者はconfigファイルでシード（「最初の管理者を誰が招待するか」という鶏卵問題の解消）→同じGoogleアカウントでサインインするだけで有効化される
- 権限は管理者／一般メンバーの2段階
- フロア図アップロードAPI（`/api/floors/[floorId]/image`）・予約作成は、サーバー側で管理者／組織メンバーであることを再チェックする（UIを隠すだけに頼らない）

**設計判断の経緯**：当初はSupabase Auth（メール+パスワード→Google OAuthへの移行）で実装していたが、(1) 招待メールのリンクがSupabaseダッシュボードの Site URL/Redirect URLs 設定に強く依存し、設定漏れで容易にリダイレクトが壊れる、(2) Google OAuth移行時にPKCEの`code_verifier`が見つからないエラーが解消できない、という2つの問題に繰り返し当たった。原因を深追いするより、Next.js App Router向けに実績が豊富なAuth.jsに認証だけを切り出し、認可（役割・組織）は元々分離してあった自前の`users`テーブル設計をそのまま活かす方針に切り替えた。この切り替えにより、招待メールの送信自体が不要になり（Googleでサインインするだけで済むため）、ダッシュボード設定への依存も消えた。

### フロア図（背景画像）
会議室の矩形配置だけでは「入り口からどれくらい離れているか」等の距離感が掴みにくいため、実際のフロア図画像を背景に表示できるようにした。画像はSupabase Storageに保存し、`floors`テーブルに元画像のピクセルサイズ（`floorPlanImageWidth/Height`）を保持することで、SVGの`viewBox`を画像の座標系に一致させ、会議室の矩形がずれずに重なるようにしている。

表示方式は画像の有無で使い分けている。画像があるフロアは、画像を拡大縮小せず実ピクセルサイズのまま表示し、画面に収まらない分はスクロールする（コンテナに`overflow-auto`、SVGの`width`/`height`を画像サイズに固定）。画像が無いフロアは、表示エリア自体を1フロア分として使い、部屋の配置範囲に合わせて拡大縮小する（`aspect-ratio`固定のコンテナ内で`preserveAspectRatio`によりレターボックス表示）。当初は両方とも固定比率のコンテナに収めようとしたが、画像の縦横比・部屋の配置状況によって表示サイズが変動したり、編集中（保存前）の変更がSVGの座標系に反映されず見た目のサイズがずれたりする不具合が続いたため、この使い分けに落ち着いた。

## 4. 技術スタック

- フロントエンド／バックエンド：Next.js（App Router）+ TypeScript
- 認証：Auth.js（Google OAuth）
- DB：Supabase（PostgreSQL）、ORM：Drizzle
- ストレージ：Supabase Storage（フロア図画像）
- テスト：Vitest
- デプロイ：Vercel

## 5. セットアップ

```bash
npm install
cp .env.example .env   # SupabaseのDATABASE_URL・Auth.js/Google関連の値を設定（.env.exampleにコメントあり）
npm run db:push        # テーブルを作成
npm run storage:setup  # フロア図保存用のStorageバケットを作成
npm run db:seed        # ダミーデータを投入
npm run auth:seed-admins # 最初の管理者をconfig/seed-admins.jsonからシード
npm run dev
```

Google Cloud Console（APIとサービス → 認証情報）のOAuthクライアントIDで、**承認済みのリダイレクトURI**に以下を登録しておく必要がある。
```
http://localhost:3000/api/auth/callback/google
https://<本番ドメイン>/api/auth/callback/google
```

テスト実行：

```bash
npm run test
```

## 6. 今後の展望

残りのスコープは[TASKS.md](./TASKS.md)を参照。

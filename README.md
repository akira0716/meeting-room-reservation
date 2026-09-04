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
- 認証はSupabase AuthのGoogle OAuthに一任している。パスワードを一切扱わない設計（自前でのパスワード管理どころか、そもそもパスワードという概念がアプリ側に存在しない）
  - Googleを選んだ理由：将来のGoogle Calendar API連携を見据えると、認証とCalendarへのアクセス許可を同じOAuth同意で済ませられるため（現時点ではログイン用の最小スコープのみ要求し、Calendar用スコープは連携実装時に追加する想定）
  - 招待：管理者が管理ページからメールアドレス＋roleを指定すると、`users`テーブルにstatus:"invited"の行が作られるだけ（メール送信は行わない）。管理者が「このメールアドレスのGoogleアカウントでサインインしてください」と本人に案内する運用
  - 招待された人が該当のGoogleアカウントでサインインすると、`getAuthContext()`が「authUserId未設定・同じメールアドレスのusers行」を自動的に見つけて紐付け、activeにする（招待受諾専用のページは不要）
  - 初期管理者はconfigファイルでシード（「最初の管理者を誰が招待するか」という鶏卵問題の解消）→同じ仕組みで、そのGoogleアカウントでの初回サインイン時に自動的にactiveへ紐付く
- 権限は管理者／一般メンバーの2段階
- フロア図アップロードAPI（`/api/floors/[floorId]/image`）・予約作成は、サーバー側で管理者／組織メンバーであることを再チェックする（UIを隠すだけに頼らない）

**ハマった点**：開発中、Supabaseの管理API（`generateLink`等）で発行したリンクは、認証情報をURLの**ハッシュ部分**（`#access_token=...`）で返すことに気づいた。ハッシュはブラウザからサーバーに送信されないため、OAuthのPKCEコード（`?code=...`）を前提にサーバー側Route Handlerで処理していた最初の実装では検知できなかった。`/auth/callback`をクライアントコンポーネントに書き換え、ハッシュとコードの両方に対応させて解決した（[`AuthCallbackHandler.tsx`](./src/components/AuthCallbackHandler.tsx)）。Google OAuthの`signInWithOAuth()`フロー自体はブラウザ発行のPKCEコード（`?code=...`）で戻ってくるため、この対応は主に開発時の動作確認（メール送信を伴わないリンク発行）のために活きている。

### フロア図（背景画像）
会議室の矩形配置だけでは「入り口からどれくらい離れているか」等の距離感が掴みにくいため、実際のフロア図画像を背景に表示できるようにした。画像はSupabase Storageに保存し、`floors`テーブルに元画像のピクセルサイズ（`floorPlanImageWidth/Height`）を保持することで、SVGの`viewBox`を画像の座標系に一致させ、会議室の矩形がずれずに重なるようにしている。

## 4. 技術スタック

- フロントエンド／バックエンド：Next.js（App Router）+ TypeScript
- DB：Supabase（PostgreSQL）、ORM：Drizzle
- ストレージ：Supabase Storage（フロア図画像）
- テスト：Vitest
- デプロイ：Vercel

## 5. セットアップ

```bash
npm install
cp .env.example .env   # SupabaseのDATABASE_URL等を設定
npm run db:push        # テーブルを作成
npm run storage:setup  # フロア図保存用のStorageバケットを作成
npm run db:seed        # ダミーデータを投入
npm run dev
```

Supabaseダッシュボードの **Authentication → URL Configuration → Redirect URLs** に、以下を追加しておく必要がある（未設定だとサインインが失敗する）。
```
http://localhost:3000/**
https://<本番ドメイン>/**
```

Google認証を使うため、**Authentication → Providers → Google** の有効化も必要（Google Cloud ConsoleでOAuthクライアントIDを発行し、リダイレクトURIに`https://<プロジェクト>.supabase.co/auth/v1/callback`を登録した上で、発行されたクライアントID/シークレットをSupabase側に設定する）。

テスト実行：

```bash
npm run test
```

## 6. 今後の展望

残りのスコープは[TASKS.md](./TASKS.md)を参照。

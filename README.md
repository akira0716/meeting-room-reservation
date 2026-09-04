# フロアマップ会議室予約（仮称）

会議室の空き状況を「フロアマップ」上で視覚的に確認しながら、そのまま予約できるWebアプリ。

## 1. 課題発見の経緯

自社の会議室予約は普段Googleカレンダーで運用しており、空き日時や予約自体には特に不便を感じていない。一方で、**会議室の名前と物理的な位置が視覚的に結びついていない**ため、「〇〇会議室ってどこだっけ」と探すことがある。この不便を解決するために、カレンダーの予約データはそのままに、UI（フロアマップ）だけを追加で提供するアプリとして企画した。

## 2. 要件定義・MVPスコープ

- フロア図（矩形配置）に会議室を表示し、空き/使用中を色分け表示する
- 会議室をクリックすると、当日のタイムスロット別予約状況を確認できる
- 空いている時間帯を選んで、その場で予約を作成できる
- 同じ時間帯への同時予約や、同じ予約への同時編集が競合しないよう制御する
- スコープ外（今後の展望に回す）：実際のGoogle Calendar APIとの連携、部屋配置のドラッグ&ドロップ編集

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
- 認証はSupabase Auth（マジックリンク）に乗せ、パスワード管理は自前で行わない
- 招待URL方式：管理者が管理ページから招待→招待された人がリンクを踏んでメール認証→組織に参加
- 初期管理者はconfigファイルでシード（「最初の管理者を誰が招待するか」という鶏卵問題の解消）
- 権限は管理者／一般メンバーの2段階

## 4. 技術スタック

- フロントエンド／バックエンド：Next.js（App Router）+ TypeScript
- DB：Supabase（PostgreSQL）、ORM：Drizzle
- テスト：Vitest
- デプロイ：Vercel

## 5. セットアップ

```bash
npm install
cp .env.example .env   # SupabaseのDATABASE_URL等を設定
npm run dev
```

テスト実行：

```bash
npm run test
```

## 6. 今後の展望

- 実際のGoogle Calendar APIとの連携（読み取り／書き込み）
- フロアマップ上での会議室配置のドラッグ&ドロップ編集
- 招待トークンの有効期限切れ・再送フロー
- 部屋・機能単位のより細かい権限設定

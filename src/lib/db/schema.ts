import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * 組織（テナント）。
 * デモでは1組織のみ作成するが、マルチテナント前提の構造にしておく。
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 建物。組織に紐づく。
 */
export const buildings = pgTable("buildings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
});

/**
 * 階。floorNumberは整数にして、地下はマイナス（B1 = -1）で表現する。
 * labelは「屋上」など番号で表しにくい階の表示名（任意、nullなら "{floorNumber}F" 表示）。
 */
export const floors = pgTable("floors", {
  id: uuid("id").defaultRandom().primaryKey(),
  buildingId: uuid("building_id")
    .references(() => buildings.id, { onDelete: "cascade" })
    .notNull(),
  floorNumber: integer("floor_number").notNull(),
  label: text("label"),
  // 背景として表示するフロア図（Supabase Storageのオブジェクトパス）。未設定ならフロア図なしで表示する
  floorPlanImagePath: text("floor_plan_image_path"),
  // フロア図の元画像サイズ（px）。SVGのviewBoxを画像に合わせて座標系を一致させるために使う
  floorPlanImageWidth: integer("floor_plan_image_width"),
  floorPlanImageHeight: integer("floor_plan_image_height"),
});

/**
 * 会議室。フロアマップ上の矩形配置座標を持つ。
 */
export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  floorId: uuid("floor_id")
    .references(() => floors.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  positionX: integer("position_x").notNull(),
  positionY: integer("position_y").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  capacity: integer("capacity"),
});

/**
 * ユーザー。Auth.js（Google OAuth）のアカウント(authUserId)と組織を紐づける。
 * role: 'admin' | 'member'、status: 'invited' | 'active'
 *
 * authUserIdは、管理者のconfigシード時点や招待発行時点ではnull（まだ一度もサインインしていない）。
 * 本人が初めてGoogleでサインインしたときに、emailが一致するこの行にauthUserId（Googleのsub）を紐づける。
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    // Auth.js側のアカウントID（Googleの場合はprofile.sub＝数値文字列で、UUID形式ではないためtext）
    authUserId: text("auth_user_id"),
    email: text("email").notNull(),
    name: text("name"),
    role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
    status: text("status", { enum: ["invited", "active"] }).notNull().default("invited"),
    invitedBy: uuid("invited_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_auth_user_id_idx").on(table.authUserId),
    uniqueIndex("users_organization_id_email_idx").on(table.organizationId, table.email),
  ],
);

/**
 * 予約。versionは楽観ロック用（更新時にversionが一致しない場合は競合エラーとする）。
 *
 * 予約者は自由入力（旧bookerName）ではなく、作成時のログイン中ユーザーで固定する。
 * createdByUserIdはnullable：ユーザーが組織から削除された後もこの予約自体（＝その時間は
 * 使用中という情報）は残したいため、onDelete: cascadeではなくset nullにしている
 * （表示側は予約者不明として扱う）。
 */
export const reservations = pgTable("reservations", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id")
    .references(() => rooms.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  // 予約者名の自由入力欄を廃止した代わりに設けた、任意の備考欄（URL等も入力可）
  note: text("note"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  version: integer("version").notNull().default(1),
});

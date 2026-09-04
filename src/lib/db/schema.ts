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
 * ユーザー。Supabase Authのユーザー(authUserId)と組織を紐づける。
 * role: 'admin' | 'member'、status: 'invited' | 'active'
 *
 * authUserIdは、管理者のconfigシード時点や招待発行時点ではnull（まだ一度もサインインしていない）。
 * 本人が初めてSupabase Authでサインインしたときに、emailが一致するこの行にauthUserIdを紐づける。
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    authUserId: uuid("auth_user_id"), // Supabase Auth側のユーザーID（別スキーマのため外部キー制約は張らない）
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
 * 招待。管理者が発行し、招待された人はtokenを使って参加する。
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    token: text("token").notNull(),
    role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
    invitedBy: uuid("invited_by")
      .references(() => users.id)
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("invitations_token_idx").on(table.token)],
);

/**
 * 予約。versionは楽観ロック用（更新時にversionが一致しない場合は競合エラーとする）。
 * bookerName: 予約者名（会議の主催者とは限らないため organizerName ではなく bookerName とする）
 */
export const reservations = pgTable("reservations", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id")
    .references(() => rooms.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  bookerName: text("booker_name").notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  version: integer("version").notNull().default(1),
});

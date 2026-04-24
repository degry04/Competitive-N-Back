import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  rating: integer("rating").notNull().default(1000),
  rank: text("rank").notNull().default("Silver"),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
});

export const rounds = sqliteTable("rounds", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  n: integer("n").notNull(),
  mode: text("mode", { enum: ["classic", "recent-5", "go-no-go", "reaction-time", "stroop"] }).notNull().default("classic"),
  tournament: integer("tournament", { mode: "boolean" }).notNull().default(false),
  rated: integer("rated", { mode: "boolean" }).notNull().default(false),
  botAccuracy: integer("bot_accuracy"),
  length: integer("length").notNull(),
  baseIntervalMs: integer("base_interval_ms").notNull(),
  currentIntervalMs: integer("current_interval_ms").notNull(),
  status: text("status", { enum: ["lobby", "running", "finished"] }).notNull(),
  sequenceJson: text("sequence_json").notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  winnerUserId: text("winner_user_id"),
  ratingProcessed: integer("rating_processed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull()
});

export const roundPlayers = sqliteTable("round_players", {
  id: text("id").primaryKey(),
  roundId: text("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  correct: integer("correct").notNull().default(0),
  errors: integer("errors").notNull().default(0),
  penalty: integer("penalty").notNull().default(0),
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull()
});

export const responses = sqliteTable("responses", {
  id: text("id").primaryKey(),
  roundId: text("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  stimulusIndex: integer("stimulus_index").notNull(),
  expectedMatch: integer("expected_match", { mode: "boolean" }).notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
  intervalAfterMs: integer("interval_after_ms").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull()
});

export const ratingHistory = sqliteTable("rating_history", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  roundId: text("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  oldRating: integer("old_rating").notNull(),
  newRating: integer("new_rating").notNull(),
  change: integer("change").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull()
});

export type RoundStatus = typeof rounds.$inferSelect.status;

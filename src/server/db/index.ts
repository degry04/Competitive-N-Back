import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "file:./data/nback.sqlite";
const sqlitePath = getLocalSqlitePath(databaseUrl);
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build";

if (sqlitePath) {
  mkdirSync(dirname(resolve(sqlitePath)), { recursive: true });
}

const sqlite = createClient({
  url: databaseUrl
});

if (!isBuildPhase) {
  await ensureLocalSchema(sqlite);
}

export const db = drizzle(sqlite, { schema });

async function ensureLocalSchema(client: ReturnType<typeof createClient>) {
  const existingTables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = new Set(existingTables.rows.map((row) => String(row.name)));

  if (!tableNames.has("user")) {
    await client.execute(`
      CREATE TABLE \`user\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`name\` text NOT NULL,
        \`email\` text NOT NULL,
        \`rating\` integer DEFAULT 1000 NOT NULL,
        \`rank\` text DEFAULT 'Silver' NOT NULL,
        \`email_verified\` integer NOT NULL,
        \`image\` text,
        \`created_at\` integer NOT NULL,
        \`updated_at\` integer NOT NULL
      )
    `);
    await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS `user_email_unique` ON `user` (`email`)");
    tableNames.add("user");
  }

  if (!tableNames.has("session")) {
    await client.execute(`
      CREATE TABLE \`session\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`expires_at\` integer NOT NULL,
        \`token\` text NOT NULL,
        \`created_at\` integer NOT NULL,
        \`updated_at\` integer NOT NULL,
        \`ip_address\` text,
        \`user_agent\` text,
        \`user_id\` text NOT NULL,
        FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
      )
    `);
    await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS `session_token_unique` ON `session` (`token`)");
    tableNames.add("session");
  }

  if (!tableNames.has("account")) {
    await client.execute(`
      CREATE TABLE \`account\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`account_id\` text NOT NULL,
        \`provider_id\` text NOT NULL,
        \`user_id\` text NOT NULL,
        \`access_token\` text,
        \`refresh_token\` text,
        \`id_token\` text,
        \`access_token_expires_at\` integer,
        \`refresh_token_expires_at\` integer,
        \`scope\` text,
        \`password\` text,
        \`created_at\` integer NOT NULL,
        \`updated_at\` integer NOT NULL,
        FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
      )
    `);
    tableNames.add("account");
  }

  if (!tableNames.has("verification")) {
    await client.execute(`
      CREATE TABLE \`verification\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`identifier\` text NOT NULL,
        \`value\` text NOT NULL,
        \`expires_at\` integer NOT NULL,
        \`created_at\` integer,
        \`updated_at\` integer
      )
    `);
    tableNames.add("verification");
  }

  if (!tableNames.has("rounds")) {
    await client.execute(`
      CREATE TABLE \`rounds\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`owner_id\` text NOT NULL,
        \`n\` integer NOT NULL,
        \`mode\` text DEFAULT 'classic' NOT NULL,
        \`tournament\` integer DEFAULT false NOT NULL,
        \`rated\` integer DEFAULT false NOT NULL,
        \`bot_accuracy\` integer,
        \`length\` integer NOT NULL,
        \`base_interval_ms\` integer NOT NULL,
        \`current_interval_ms\` integer NOT NULL,
        \`status\` text NOT NULL,
        \`sequence_json\` text NOT NULL,
        \`started_at\` integer,
        \`finished_at\` integer,
        \`winner_user_id\` text,
        \`rating_processed\` integer DEFAULT false NOT NULL,
        \`created_at\` integer NOT NULL,
        FOREIGN KEY (\`owner_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
      )
    `);
    tableNames.add("rounds");
  }

  if (!tableNames.has("round_players")) {
    await client.execute(`
      CREATE TABLE \`round_players\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`round_id\` text NOT NULL,
        \`user_id\` text NOT NULL,
        \`display_name\` text NOT NULL,
        \`correct\` integer DEFAULT 0 NOT NULL,
        \`errors\` integer DEFAULT 0 NOT NULL,
        \`penalty\` integer DEFAULT 0 NOT NULL,
        \`joined_at\` integer NOT NULL,
        FOREIGN KEY (\`round_id\`) REFERENCES \`rounds\`(\`id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
      )
    `);
    tableNames.add("round_players");
  }

  if (!tableNames.has("responses")) {
    await client.execute(`
      CREATE TABLE \`responses\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`round_id\` text NOT NULL,
        \`user_id\` text NOT NULL,
        \`stimulus_index\` integer NOT NULL,
        \`expected_match\` integer NOT NULL,
        \`is_correct\` integer NOT NULL,
        \`interval_after_ms\` integer NOT NULL,
        \`created_at\` integer NOT NULL,
        FOREIGN KEY (\`round_id\`) REFERENCES \`rounds\`(\`id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
      )
    `);
    tableNames.add("responses");
  }

  if (tableNames.has("user")) {
    const userColumns = await client.execute("PRAGMA table_info('user')");
    const columnNames = new Set(userColumns.rows.map((row) => String(row.name)));

    if (!columnNames.has("rating")) {
      await client.execute("ALTER TABLE `user` ADD `rating` integer DEFAULT 1000 NOT NULL");
    }
    if (!columnNames.has("rank")) {
      await client.execute("ALTER TABLE `user` ADD `rank` text DEFAULT 'Silver' NOT NULL");
    }
  }

  if (tableNames.has("rounds")) {
    const roundColumns = await client.execute("PRAGMA table_info('rounds')");
    const columnNames = new Set(roundColumns.rows.map((row) => String(row.name)));

    if (!columnNames.has("rating_processed")) {
      await client.execute("ALTER TABLE `rounds` ADD `rating_processed` integer DEFAULT false NOT NULL");
    }
    if (!columnNames.has("rated")) {
      await client.execute("ALTER TABLE `rounds` ADD `rated` integer DEFAULT false NOT NULL");
    }
  }

  if (!tableNames.has("rating_history")) {
    await client.execute(`
      CREATE TABLE \`rating_history\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`user_id\` text NOT NULL,
        \`round_id\` text NOT NULL,
        \`old_rating\` integer NOT NULL,
        \`new_rating\` integer NOT NULL,
        \`change\` integer NOT NULL,
        \`created_at\` integer NOT NULL,
        FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`round_id\`) REFERENCES \`rounds\`(\`id\`) ON UPDATE no action ON DELETE cascade
      )
    `);
    tableNames.add("rating_history");
  }

  if (!tableNames.has("chat_rooms")) {
    await client.execute(`
      CREATE TABLE \`chat_rooms\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`name\` text NOT NULL,
        \`type\` text DEFAULT 'room' NOT NULL,
        \`owner_id\` text,
        \`created_at\` integer NOT NULL,
        FOREIGN KEY (\`owner_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE set null
      )
    `);
    tableNames.add("chat_rooms");
  }

  if (!tableNames.has("chat_members")) {
    await client.execute(`
      CREATE TABLE \`chat_members\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`room_id\` text NOT NULL,
        \`user_id\` text NOT NULL,
        \`joined_at\` integer NOT NULL,
        FOREIGN KEY (\`room_id\`) REFERENCES \`chat_rooms\`(\`id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
      )
    `);
    tableNames.add("chat_members");
  }

  if (!tableNames.has("chat_messages")) {
    await client.execute(`
      CREATE TABLE \`chat_messages\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`room_id\` text NOT NULL,
        \`user_id\` text NOT NULL,
        \`body\` text NOT NULL,
        \`created_at\` integer NOT NULL,
        FOREIGN KEY (\`room_id\`) REFERENCES \`chat_rooms\`(\`id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
      )
    `);
    tableNames.add("chat_messages");
  }

  if (!tableNames.has("friendships")) {
    await client.execute(`
      CREATE TABLE \`friendships\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`requester_id\` text NOT NULL,
        \`addressee_id\` text NOT NULL,
        \`status\` text DEFAULT 'pending' NOT NULL,
        \`created_at\` integer NOT NULL,
        FOREIGN KEY (\`requester_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`addressee_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
      )
    `);
    tableNames.add("friendships");
  }

  await client.execute(`
    INSERT OR IGNORE INTO \`chat_rooms\` (\`id\`, \`name\`, \`type\`, \`owner_id\`, \`created_at\`)
    VALUES ('global', 'Общий чат', 'global', NULL, unixepoch() * 1000)
  `);
}

function getLocalSqlitePath(url: string) {
  if (url.startsWith("file:")) {
    return url.slice("file:".length);
  }

  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(url)) {
    return url;
  }

  return null;
}

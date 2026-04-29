import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const databaseUrl = process.env.DATABASE_URL ?? "file:./data/nback.sqlite";
const email = (process.env.TEST_ACCOUNT_EMAIL ?? "test@example.com").trim().toLowerCase();
const password = process.env.TEST_ACCOUNT_PASSWORD ?? "Test12345!";
const name = (process.env.TEST_ACCOUNT_NAME ?? "Тестировщик").trim();
const image = process.env.TEST_ACCOUNT_IMAGE ?? null;

const sqlitePath = getLocalSqlitePath(databaseUrl);

if (sqlitePath) {
  mkdirSync(dirname(resolve(sqlitePath)), { recursive: true });
}

const db = createClient({ url: databaseUrl });

await ensureAuthTables();

const now = Date.now();
const existingUser = await db.execute({
  sql: "SELECT id FROM `user` WHERE lower(email) = lower(?) LIMIT 1",
  args: [email]
});
const userId = existingUser.rows[0]?.id?.toString() ?? randomUUID();
const passwordHash = await hashPassword(password);

if (existingUser.rows.length > 0) {
  await db.execute({
    sql: "UPDATE `user` SET name = ?, image = COALESCE(?, image), updated_at = ? WHERE id = ?",
    args: [name, image, now, userId]
  });
} else {
  await db.execute({
    sql: `
      INSERT INTO \`user\` (id, name, email, rating, rank, email_verified, image, created_at, updated_at)
      VALUES (?, ?, ?, 1000, 'Silver', 1, ?, ?, ?)
    `,
    args: [userId, name, email, image, now, now]
  });
}

const existingAccount = await db.execute({
  sql: "SELECT id FROM account WHERE user_id = ? AND provider_id = 'credential' LIMIT 1",
  args: [userId]
});

if (existingAccount.rows.length > 0) {
  await db.execute({
    sql: "UPDATE account SET account_id = ?, password = ?, updated_at = ? WHERE id = ?",
    args: [userId, passwordHash, now, existingAccount.rows[0].id]
  });
} else {
  await db.execute({
    sql: `
      INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
      VALUES (?, ?, 'credential', ?, ?, ?, ?)
    `,
    args: [randomUUID(), userId, userId, passwordHash, now, now]
  });
}

// eslint-disable-next-line no-console
console.log("Тестовый аккаунт готов:");
// eslint-disable-next-line no-console
console.log(`  email: ${email}`);
// eslint-disable-next-line no-console
console.log(`  пароль: ${password}`);
// eslint-disable-next-line no-console
console.log(`  ник: ${name}`);

function getLocalSqlitePath(url) {
  if (!url.startsWith("file:")) {
    return null;
  }

  return url.slice("file:".length);
}

async function hashPassword(rawPassword) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(rawPassword.normalize("NFKC"), salt, 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 128 * 16384 * 16 * 2
  });

  return `${salt}:${Buffer.from(key).toString("hex")}`;
}

async function ensureAuthTables() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS \`user\` (
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
  await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS `user_email_unique` ON `user` (`email`)");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS account (
      id text PRIMARY KEY NOT NULL,
      account_id text NOT NULL,
      provider_id text NOT NULL,
      user_id text NOT NULL,
      access_token text,
      refresh_token text,
      id_token text,
      access_token_expires_at integer,
      refresh_token_expires_at integer,
      scope text,
      password text,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (user_id) REFERENCES \`user\`(id) ON UPDATE no action ON DELETE cascade
    )
  `);
}

import { defineConfig } from "drizzle-kit";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databaseUrl = process.env.DATABASE_URL ?? "file:./data/nback.sqlite";
const sqlitePath = getLocalSqlitePath(databaseUrl);

if (sqlitePath) {
  mkdirSync(dirname(resolve(sqlitePath)), { recursive: true });
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: databaseUrl
  }
});

function getLocalSqlitePath(url: string) {
  if (url.startsWith("file:")) {
    return url.slice("file:".length);
  }

  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(url)) {
    return url;
  }

  return null;
}

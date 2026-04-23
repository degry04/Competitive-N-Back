import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "file:./data/nback.sqlite";
const databasePath = resolve(databaseUrl.replace(/^file:/, ""));

mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = createClient({
  url: databaseUrl.startsWith("file:") ? databaseUrl : `file:${databasePath}`
});

export const db = drizzle(sqlite, { schema });

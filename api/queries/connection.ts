import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";
import { parseDatabaseUrl } from "@contracts/database";

const fullSchema = { ...schema, ...relations };

function createDatabase() {
  const client = mysql.createPool(
    parseDatabaseUrl(env.databaseUrl, env.databaseSsl),
  );

  return drizzle({
    client,
    mode: "default",
    schema: fullSchema,
  });
}

let instance: ReturnType<typeof createDatabase> | undefined;

export function getDb() {
  if (!instance) {
    instance = createDatabase();
  }
  return instance;
}

import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { parseDatabaseUrl } from "./contracts/database";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "mysql",
  dbCredentials: parseDatabaseUrl(
    connectionString,
    process.env.DATABASE_SSL === "true",
  ),
});

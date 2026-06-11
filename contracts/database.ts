import type { ConnectionOptions } from "mysql2";

export function parseDatabaseUrl(
  connectionString: string,
  useSsl: boolean,
): ConnectionOptions {
  const url = new URL(connectionString);

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: useSsl ? { rejectUnauthorized: true } : undefined,
  };
}

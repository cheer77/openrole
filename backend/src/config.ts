import "dotenv/config";
import { z } from "zod";

export const config = z
  .object({
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().default("redis://127.0.0.1:6380"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    HOST: z.string().default("127.0.0.1"),
    CORS_ORIGINS: z
      .string()
      .default("http://localhost:3000,http://127.0.0.1:3000"),
  })
  .parse(process.env);

export function redisConnection() {
  const url = new URL(config.REDIS_URL);
  if (!["redis:", "rediss:"].includes(url.protocol))
    throw new Error("Invalid Redis protocol");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number(url.pathname.slice(1) || 0),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

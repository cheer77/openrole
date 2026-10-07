import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  HttpException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Database } from "./db.js";
const scrypt = promisify(scryptCallback);
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const sessionHash = (token: string) =>
  hashToken(token + (process.env.OWNER_PASSWORD_HASH || ""));
export function internalAccess(value: string | undefined) {
  const expected = process.env.INTERNAL_API_KEY;
  if (
    !expected ||
    expected.length < 32 ||
    !value ||
    !timingSafeEqual(
      Buffer.from(hashToken(value)),
      Buffer.from(hashToken(expected)),
    )
  )
    throw new UnauthorizedException();
}
// Bounded per-process limits for the single-instance MVP; replace with Redis when scaling API replicas.
const limits = new Map<string, { count: number; until: number }>();
export function rateLimit(key: string, max: number, ms: number) {
  const now = Date.now();
  if (limits.size > 10000)
    for (const [k, v] of limits) if (v.until <= now) limits.delete(k);
  const current = limits.get(key);
  if (current && current.until > now) {
    if (++current.count > max)
      throw new HttpException("Please try again later", 429);
  } else {
    if (limits.size >= 20000)
      throw new HttpException("Please try again later", 429);
    limits.set(key, { count: 1, until: now + ms });
  }
}
export async function loginOwner(db: Database["client"], password: string) {
  rateLimit("owner-login", 10, 300000);
  const encoded = process.env.OWNER_PASSWORD_HASH || "";
  const [salt, expectedHex] = encoded.split(":");
  if (
    !/^[a-f0-9]{32}$/.test(salt || "") ||
    !/^[a-f0-9]{128}$/.test(expectedHex || "")
  )
    throw new ServiceUnavailableException(
      "Owner access has not been configured",
    );
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  if (!timingSafeEqual(actual, Buffer.from(expectedHex, "hex")))
    throw new UnauthorizedException("Invalid credentials");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 8 * 3600000);
  await db.adminSession.create({
    data: { tokenHash: sessionHash(token), expiresAt },
  });
  return { token, expiresAt };
}
@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(@Inject(Database) private readonly db: Database) {}
  async canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string } }>();
    const token = req.headers.authorization?.replace(/^Bearer /, "") || "";
    if (!/^[a-f0-9]{64}$/.test(token)) throw new UnauthorizedException();
    const session = await this.db.client.adminSession.findUnique({
      where: { tokenHash: sessionHash(token) },
    });
    if (!session || session.expiresAt.getTime() <= Date.now())
      throw new UnauthorizedException();
    return true;
  }
}

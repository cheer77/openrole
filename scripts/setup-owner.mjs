import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
const password =
  process.env.ADMIN_PASSWORD || randomBytes(18).toString("base64url");
if (password.length < 14)
  throw new Error("ADMIN_PASSWORD must be at least 14 characters");
const salt = randomBytes(16).toString("hex");
const key = randomBytes(32).toString("hex");
const hash = salt + ":" + scryptSync(password, salt, 64).toString("hex");
if (existsSync(".env.owner") && process.argv[2] !== "--rotate")
  throw new Error(
    "Owner already configured. Use --rotate to change credentials and restart services.",
  );
writeFileSync(
  ".env.owner",
  `OWNER_PASSWORD_HASH=${hash}\nINTERNAL_API_KEY=${key}\n`,
  { mode: 0o600 },
);
const file = ".env.local";
const current = existsSync(file) ? readFileSync(file, "utf8") : "";
const filtered = current
  .split("\n")
  .filter(
    (line) =>
      !line.startsWith("INTERNAL_API_KEY=") &&
      !line.startsWith("ADMIN_COOKIE_SECURE="),
  )
  .join("\n");
writeFileSync(
  file,
  filtered +
    `\nINTERNAL_API_KEY=${key}\n# Local HTTP only. Remove this override for HTTPS deployment.\nADMIN_COOKIE_SECURE=false\n`,
  { mode: 0o600 },
);
writeFileSync(
  ".owner-credentials.local",
  `Owner panel: /admin\nPassword: ${password}\n\nStore this password securely and remove this file afterwards.\nPassword rotation invalidates previous sessions after backend restart.\n`,
  { mode: 0o600 },
);
for (const path of [".env.owner", ".env.local", ".owner-credentials.local"])
  chmodSync(path, 0o600);
console.log(
  "Owner configured. Credentials saved to .owner-credentials.local (not tracked by Git). Restart Next.js and the backend.",
);

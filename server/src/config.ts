import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "..", ".env"));
} catch {
  /* pas de .env : tout vient de l'environnement */
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, "data");

function sessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) {
      throw new Error("SESSION_SECRET doit faire au moins 32 caractères");
    }
    return process.env.SESSION_SECRET;
  }
  const file = path.join(dataDir, ".session-secret");
  fs.mkdirSync(dataDir, { recursive: true });
  if (fs.existsSync(file)) {
    return fs.readFileSync(file, "utf8").trim();
  }
  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}
const authMode = (process.env.AUTH_MODE ?? "dev") as "dev" | "oidc";

if (authMode !== "dev" && authMode !== "oidc") {
  throw new Error(`AUTH_MODE invalide : ${authMode} (attendu dev | oidc)`);
}

const production = process.env.NODE_ENV === "production";

if (production && authMode === "dev") {
  throw new Error(
    "AUTH_MODE=dev est refusé en production : quiconque atteindrait le serveur deviendrait administrateur. Renseignez OIDC_*.",
  );
}

export const config = {
  root,
  production,
  host: process.env.HOST ?? "0.0.0.0",
  trustProxy: (process.env.TRUST_PROXY ?? "false") === "true",
  cookieSecure: (process.env.COOKIE_SECURE ?? "false") === "true",
  port: Number(process.env.PORT ?? 8099),
  instanceName: process.env.INSTANCE_NAME ?? "La Tanière",
  baseUrl: process.env.BASE_URL ?? "http://localhost:8099",
  dataDir,
  mediaDir: path.join(root, "data", "media"),
  dbFile: path.join(root, "data", "clipvault.db"),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_GB ?? 4) * 1024 * 1024 * 1024,
  sessionSecret: sessionSecret(),
  auth:
    authMode === "dev"
      ? ({ mode: "dev" } as const)
      : ({
          mode: "oidc",
          issuer: required("OIDC_ISSUER"),
          clientId: required("OIDC_CLIENT_ID"),
          clientSecret: required("OIDC_CLIENT_SECRET"),
          redirectUri: process.env.OIDC_REDIRECT_URI ?? "",
          scopes: process.env.OIDC_SCOPES ?? "openid profile email",
          autoCreate: (process.env.OIDC_AUTO_CREATE ?? "true") === "true",
          adminGroup: process.env.OIDC_ADMIN_GROUP ?? "clipvault-admins",
        } as const),
} as const;

export type Config = typeof config;

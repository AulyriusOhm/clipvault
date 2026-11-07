import path from "node:path";
import Fastify, { type FastifyError } from "fastify";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import session from "@fastify/session";
import fastifyStatic from "@fastify/static";
import view from "@fastify/view";
import ejs from "ejs";
import { currentUser } from "./auth.ts";
import { config } from "./config.ts";
import { baseContext } from "./context.ts";
import { getSettings } from "./db.ts";
import * as fmt from "./format.ts";
import { adminRoutes } from "./routes/admin.ts";
import { authRoutes } from "./routes/auth.ts";
import { clipRoutes } from "./routes/clips.ts";
import { pageRoutes } from "./routes/pages.ts";
import { uploadRoutes } from "./routes/upload.ts";

declare module "fastify" {
  interface FastifyRequest {
    user?: import("./db.ts").User;
  }
}

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
  trustProxy: config.trustProxy,
  bodyLimit: 1024 * 1024,
});

await app.register(cookie);
await app.register(session, {
  secret: config.sessionSecret,
  cookie: { path: "/", httpOnly: true, sameSite: "lax", secure: config.cookieSecure, maxAge: 30 * 24 * 3600 },
  saveUninitialized: false,
});
await app.register(formbody);
await app.register(multipart, {
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  throwFileSizeLimit: false,
});
await app.register(rateLimit, {
  global: false,
  max: 120,
  timeWindow: "1 minute",
  allowList: [],
});

await app.register(fastifyStatic, {
  root: path.join(config.root, "public"),
  prefix: "/assets/",
});
await app.register(view, {
  engine: { ejs },
  root: path.join(config.root, "templates"),
  viewExt: "ejs",
  defaultContext: { fmt, config },
});

app.addHook("onSend", async (request, reply, payload) => {
  reply.header("x-content-type-options", "nosniff");
  reply.header("x-frame-options", "DENY");
  reply.header("referrer-policy", "no-referrer");
  reply.header("permissions-policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  reply.header("cross-origin-opener-policy", "same-origin");
  reply.header(
    "content-security-policy",
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "media-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  if (config.cookieSecure) {
    reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
  return payload;
});

app.addHook("onRequest", async (request) => {
  request.user = currentUser(request);
});

/**
 * SameSite=Lax arrête un POST venu d'un autre site, mais pas d'un autre
 * sous-domaine du même site : une page servie depuis *.lanro.eu posterait avec
 * le cookie de session. On refuse donc toute méthode qui écrit si l'origine
 * déclarée n'est pas celle de l'instance.
 */
app.addHook("onRequest", async (request, reply) => {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return;
  }
  const origine = request.headers.origin;
  if (!origine) {
    return;
  }
  let hote: string;
  try {
    hote = new URL(origine).host;
  } catch {
    return reply.code(403).send({ error: "origine invalide" });
  }
  const attendu = new URL(getSettings().public_url || config.baseUrl).host;
  if (hote !== attendu) {
    request.log.warn({ origine, attendu }, "requête d'écriture refusée : origine étrangère");
    return reply.code(403).send({ error: "origine refusée" });
  }
});

await app.register(pageRoutes);
await app.register(authRoutes);
await app.register(clipRoutes);
await app.register(uploadRoutes);
await app.register(adminRoutes);

app.setNotFoundHandler(async (request, reply) => {
  reply.code(404);
  return reply.view("error.ejs", {
    ...baseContext(request),
    title: "Page introuvable — ClipVault",
    heading: "Cette page n'existe pas",
    sub: `${request.url} — 404`,
    body: "L'adresse demandée ne correspond à aucune page de l'instance.",
    actions: [
      { href: "/", label: "Voir la bibliothèque" },
      { href: "/upload", label: "Déposer un clip" },
    ],
  });
});

app.setErrorHandler(async (error: FastifyError, request, reply) => {
  request.log.error(error);
  const status = error.statusCode ?? 500;
  reply.code(status);
  return reply.view("error.ejs", {
    ...baseContext(request),
    title: "Erreur — ClipVault",
    heading: status === 404 ? "Cette page n'existe pas" : "Quelque chose a cassé",
    sub: `${request.url} — ${status}`,
    body: error.message,
    actions: [{ href: "/", label: "Voir la bibliothèque" }],
  });
});

await app.listen({ host: config.host, port: config.port });
app.log.info(`ClipVault prêt sur http://${config.host}:${config.port} · auth ${config.auth.mode}`);

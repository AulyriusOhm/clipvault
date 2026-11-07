import type { FastifyInstance } from "fastify";
import { buildLoginUrl, completeLogin, devSignIn, logoutUrl } from "../auth.ts";
import { baseContext } from "../context.ts";
import { publicHighlights } from "../db.ts";
import { config } from "../config.ts";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get("/login", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const q = request.query as Record<string, string | undefined>;
    return reply.view("login.ejs", {
      ...baseContext(request),
      title: "Connexion — ClipVault",
      showcase: publicHighlights(3),
      next: q.next ?? "/",
      error: q.error ?? null,
    });
  });

  app.post("/auth/dev-login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    if (config.auth.mode !== "dev") {
      return reply.code(404).send({ error: "not found" });
    }
    const { next } = request.body as { next?: string };
    const user = devSignIn(request);
    request.log.info({ user: user.username }, "connexion dev");
    return reply.redirect(next && next.startsWith("/") ? next : "/");
  });

  app.get("/auth/start", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    if (config.auth.mode === "dev") {
      return reply.redirect("/login");
    }
    const next = (request.query as Record<string, string | undefined>).next;
    if (next) {
      request.session.returnTo = next;
    }
    return reply.redirect(await buildLoginUrl(request));
  });

  app.get("/auth/callback", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const q = request.query as Record<string, string | undefined>;
    if (q.error) {
      return reply.redirect(`/login?error=${encodeURIComponent(q.error_description ?? q.error)}`);
    }
    if (!q.code || !q.state) {
      return reply.redirect("/login?error=callback%20incomplet");
    }
    try {
      const user = await completeLogin(request, q.code, q.state);
      request.log.info({ user: user.username }, "connexion OIDC");
      const target = request.session.returnTo ?? "/";
      delete request.session.returnTo;
      return reply.redirect(target.startsWith("/") ? target : "/");
    } catch (error) {
      request.log.error(error);
      const message = error instanceof Error ? error.message : "échec de connexion";
      return reply.redirect(`/login?error=${encodeURIComponent(message)}`);
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    const target = await logoutUrl(request);
    await request.session.destroy();
    return reply.redirect(target ?? "/login");
  });
}

declare module "fastify" {
  interface Session {
    returnTo?: string;
  }
}

import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { baseContext } from "../context.ts";
import { DEFAULT_THEME, THEMES } from "../theme.ts";
import {
  createInvite,
  getSettings,
  listInvites,
  listMembers,
  revokeInvite,
  saveSettings,
  setMemberRole,
  usableInvite,
  findInvite,
} from "../db.ts";

function normaliseUrl(value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) {
    return "";
  }
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const parsed = new URL(withScheme);
    return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function requireAdmin(request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void): void {
  if (!request.user) {
    reply.redirect(`/login?next=${encodeURIComponent("/admin")}`);
    return;
  }
  if (request.user.role !== "admin") {
    reply.code(403);
    reply.view("error.ejs", {
      ...baseContext(request),
      title: "Accès refusé — ClipVault",
      heading: "Réservé aux administrateurs",
      sub: "/admin — 403",
      body: "Votre compte n'a pas le rôle administrateur sur cette instance.",
      actions: [{ href: "/library", label: "Retour à la bibliothèque" }],
    });
    return;
  }
  done();
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin", { preHandler: requireAdmin }, async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    return reply.view("admin.ejs", {
      ...baseContext(request),
      title: "Réglages — ClipVault",
      active: "admin",
      settings: getSettings(),
      members: listMembers(),
      invites: listInvites(),
      flash: query.ok === "settings" ? "Réglages enregistrés." : query.ok === "invite" ? "Invitation créée." : query.ok === "revoke" ? "Invitation révoquée." : query.ok === "role" ? "Rôle mis à jour." : null,
      error: query.error ?? null,
    });
  });

  app.post("/admin/settings", { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as Record<string, string | undefined>;
    saveSettings({
      instance_name: (body.instance_name ?? "").trim(),
      default_visibility: ["link", "members", "public"].includes(body.default_visibility ?? "") ? body.default_visibility! : "link",
      link_expiry_days: String(Math.max(0, Number(body.link_expiry_days ?? 0) || 0)),
      invite_only: body.invite_only === "on" ? "true" : "false",
      max_upload_gb: String(Math.max(1, Number(body.max_upload_gb ?? 4) || 4)),
      theme: THEMES.some((t) => t.key === body.theme) ? body.theme! : DEFAULT_THEME,
      public_url: normaliseUrl(body.public_url),
    });
    return reply.redirect("/admin?ok=settings");
  });

  app.post("/admin/invites", { preHandler: requireAdmin, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = request.body as Record<string, string | undefined>;
    const days = Math.max(0, Number(body.expires_days ?? 7) || 0);
    const token = crypto.randomBytes(12).toString("base64url");
    const expiresAt = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19).replace("T", " ") : null;
    createInvite(token, (body.note ?? "").slice(0, 80), request.user!.id, expiresAt);
    return reply.redirect("/admin?ok=invite");
  });

  app.post("/admin/invites/:id/revoke", { preHandler: requireAdmin }, async (request, reply) => {
    revokeInvite(Number((request.params as { id: string }).id));
    return reply.redirect("/admin?ok=revoke");
  });

  app.post("/admin/members/:id/role", { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as Record<string, string | undefined>;
    const id = Number((request.params as { id: string }).id);
    const role = body.role === "admin" ? "admin" : "member";
    if (request.user!.id === id && role !== "admin") {
      return reply.redirect("/admin?error=" + encodeURIComponent("impossible de retirer son propre rôle administrateur"));
    }
    setMemberRole(id, role);
    return reply.redirect("/admin?ok=role");
  });

  app.get("/join/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const invite = usableInvite(token);
    if (!invite) {
      const known = findInvite(token);
      reply.code(410);
      return reply.view("error.ejs", {
        ...baseContext(request),
        title: "Invitation invalide — ClipVault",
        heading: known?.used_at ? "Cette invitation a déjà servi" : "Invitation invalide ou expirée",
        sub: "/join — 410",
        body: known?.used_at
          ? "Le lien a déjà été utilisé. Demandez-en un nouveau à un administrateur."
          : "Le jeton n'existe pas ou a dépassé sa date limite.",
        actions: [{ href: "/login", label: "Se connecter" }],
      });
    }
    request.session.inviteToken = token;
    return reply.redirect("/login?invite=1");
  });
}

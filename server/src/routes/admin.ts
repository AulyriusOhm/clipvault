import crypto from "node:crypto";
import fs from "node:fs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { baseContext } from "../context.ts";
import { config } from "../config.ts";
import { bytes } from "../format.ts";
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

export function normaliseTags(value: string | undefined): string {
  const raw = (value ?? "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24))
    .filter(Boolean);
  return [...new Set(raw)].slice(0, 10).join(", ");
}

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
      title: "Access denied — ClipVault",
      heading: "Administrators only",
      sub: "/admin — 403",
      body: "Your account does not have the administrator role on this instance.",
      actions: [{ href: "/library", label: "Back to the library" }],
    });
    return;
  }
  done();
}

function storageUsage(): { free: string; total: string; percent: number; saturated: boolean } {
  const stats = fs.statfsSync(config.mediaDir);
  const free = Number(stats.bavail) * Number(stats.bsize);
  const total = Number(stats.blocks) * Number(stats.bsize);
  const percent = total > 0 ? Math.round(((total - free) / total) * 100) : 0;
  return { free: bytes(free), total: bytes(total), percent, saturated: free < config.maxUploadBytes };
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin", { preHandler: requireAdmin }, async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    return reply.view("admin.ejs", {
      ...baseContext(request),
      title: "Settings — ClipVault",
      active: "admin",
      settings: getSettings(),
      storage: storageUsage(),
      members: listMembers(),
      invites: listInvites(),
      flash: query.ok === "settings" ? "Settings saved." : query.ok === "invite" ? "Invitation created." : query.ok === "revoke" ? "Invitation revoked." : query.ok === "role" ? "Role updated." : null,
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
      default_tags: normaliseTags(body.default_tags),
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
      return reply.redirect("/admin?error=" + encodeURIComponent("cannot remove your own administrator role"));
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
        title: "Invalid invitation — ClipVault",
        heading: known?.used_at ? "This invitation has already been used" : "Invalid or expired invitation",
        sub: "/join — 410",
        body: known?.used_at
          ? "The link has already been used. Ask an administrator for a new one."
          : "The token does not exist or has passed its expiry date.",
        actions: [{ href: "/login", label: "Sign in" }],
      });
    }
    request.session.inviteToken = token;
    return reply.redirect("/login?invite=1");
  });
}

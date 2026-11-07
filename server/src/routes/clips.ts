import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { config } from "../config.ts";
import { baseContext } from "../context.ts";
import { getClip, getSettings, setTags, softDelete, updateClip } from "../db.ts";

function visible(clip: { visibility: string; share_expires: string | null }, userId?: number): boolean {
  if (clip.visibility === "members") {
    return Boolean(userId);
  }
  if (clip.visibility === "link" && clip.share_expires) {
    return new Date(`${clip.share_expires.replace(" ", "T")}Z`).getTime() > Date.now();
  }
  return true;
}

function abs(filePath: string): string {
  return path.join(config.mediaDir, filePath);
}

function canManage(clip: { uploader_id: number | null }, user: { id: number; role: string } | undefined): boolean {
  return Boolean(user && (user.role === "admin" || clip.uploader_id === user.id));
}

export async function clipRoutes(app: FastifyInstance): Promise<void> {
  app.get("/media/:slug/video", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const clip = getClip(slug);
    if (!clip || clip.deleted_at) {
      return reply.code(404).send({ error: "clip introuvable" });
    }
    if (!visible(clip, request.user?.id)) {
      return reply.code(403).send({ error: "accès refusé" });
    }

    const file = abs(clip.file_path);
    const stat = await fs.promises.stat(file).catch(() => null);
    if (!stat) {
      return reply.code(404).send({ error: "fichier absent du disque" });
    }

    const wantsDownload = (request.query as Record<string, string | undefined>).download === "1";
    if (wantsDownload && !request.user) {
      return reply.code(403).send({ error: "téléchargement réservé aux membres connectés" });
    }
    if (wantsDownload) {
      const extension = path.extname(clip.file_path) || ".mp4";
      const base = clip.title
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9 ._-]+/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || clip.slug;
      reply.header(
        "content-disposition",
        `attachment; filename="${base.replace(/[^\x20-\x7e]/g, "")}${extension}"; filename*=UTF-8''${encodeURIComponent(base + extension)}`,
      );
    }

    const range = request.headers.range;
    reply.header("accept-ranges", "bytes");
    reply.header("cache-control", "private, max-age=0, must-revalidate");

    if (!range) {
      reply.header("content-type", "video/mp4");
      reply.header("content-length", stat.size);
      return reply.send(fs.createReadStream(file));
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) {
      reply.header("content-range", `bytes */${stat.size}`);
      return reply.code(416).send();
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
    if (Number.isNaN(start) || start > end || start >= stat.size) {
      reply.header("content-range", `bytes */${stat.size}`);
      return reply.code(416).send();
    }

    reply.code(206);
    reply.header("content-type", "video/mp4");
    reply.header("content-length", end - start + 1);
    reply.header("content-range", `bytes ${start}-${end}/${stat.size}`);
    return reply.send(fs.createReadStream(file, { start, end }));
  });

  app.get("/media/:slug/thumb", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const clip = getClip(slug);
    if (!clip || clip.deleted_at || !clip.thumb_path) {
      return reply.code(404).send({ error: "miniature absente" });
    }
    if (!visible(clip, request.user?.id)) {
      return reply.code(403).send({ error: "accès refusé" });
    }
    const file = abs(clip.thumb_path);
    if (!fs.existsSync(file)) {
      return reply.code(404).send({ error: "miniature absente" });
    }
    reply.header("cache-control", "private, max-age=86400");
    reply.type("image/jpeg");
    return reply.send(fs.createReadStream(file));
  });

  app.get("/clips/:slug/edit", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const clip = getClip(slug);
    if (!clip || clip.deleted_at) {
      return reply.code(404).send({ error: "clip introuvable" });
    }
    if (!canManage(clip, request.user)) {
      return reply.code(403).send({ error: "modification réservée à l'auteur ou à un administrateur" });
    }
    const query = request.query as Record<string, string | undefined>;
    return reply.view("edit.ejs", {
      ...baseContext(request),
      title: `Modifier — ${clip.title}`,
      active: "library",
      clip,
      tags: clip.tags.split(" ").filter(Boolean).join(", "),
      flash: query.ok ? "Modifications enregistrées." : null,
    });
  });

  app.post("/clips/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const clip = getClip(slug);
    if (!clip || clip.deleted_at) {
      return reply.code(404).send({ error: "clip introuvable" });
    }
    if (!canManage(clip, request.user)) {
      return reply.code(403).send({ error: "modification réservée à l'auteur ou à un administrateur" });
    }

    const body = request.body as Record<string, string | undefined>;
    const title = (body.title ?? "").trim().slice(0, 90);
    if (!title) {
      return reply.redirect(`/clips/${slug}/edit?error=${encodeURIComponent("le titre ne peut pas être vide")}`);
    }
    const visibility = ["link", "members", "public"].includes(body.visibility ?? "") ? body.visibility! : clip.visibility;
    const days = Math.max(0, Number(body.expiry_days ?? 0) || 0);

    updateClip(clip.id, {
      title,
      description: (body.description ?? "").slice(0, 2000),
      game: (body.game ?? "").trim(),
      visibility,
      share_expires:
        visibility === "link" && days > 0
          ? new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19).replace("T", " ")
          : null,
    });
    setTags(clip.id, (body.tags ?? "").split(","));
    return reply.redirect(`/clips/${slug}/edit?ok=1`);
  });

  app.post("/clips/:slug/delete", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const clip = getClip(slug);
    if (!clip) {
      return reply.code(404).send({ error: "clip introuvable" });
    }
    if (!canManage(clip, request.user)) {
      return reply.code(403).send({ error: "suppression réservée à l'auteur ou à un administrateur" });
    }
    softDelete(clip.id);
    for (const file of [clip.file_path, clip.thumb_path]) {
      if (file) {
        await fs.promises.rm(abs(file), { force: true });
      }
    }
    return reply.redirect("/library");
  });
}

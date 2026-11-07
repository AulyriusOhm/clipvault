import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import { requireUser } from "../auth.ts";
import { config } from "../config.ts";
import { db, getSettings, listJobs, nextCode, recordJob, setTags, upsertGame } from "../db.ts";
import { extractThumbnail, probe } from "../media.ts";

const ALLOWED = new Set([".mp4", ".mkv", ".mov", ".webm"]);

function slugify(title: string, code: number): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${code}-${base || "clip"}`;
}

async function runPipeline(
  app: FastifyInstance,
  jobId: string,
  filename: string,
  tmpPath: string,
  fields: { title: string; game: string; tags: string; description: string; visibility: string },
  uploaderId: number,
): Promise<void> {
  let code = nextCode();
  let slug = slugify(fields.title || filename.replace(/\.[^.]+$/, ""), code);
  const ext = path.extname(filename).toLowerCase();
  const takenSlug = db.prepare("SELECT 1 FROM clips WHERE slug = ?");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (!takenSlug.get(slug) && !fs.existsSync(path.join(config.mediaDir, `${slug}${ext}`))) {
      break;
    }
    code += 1;
    slug = slugify(fields.title || filename.replace(/\.[^.]+$/, ""), code);
  }
  const storedName = `${slug}${ext}`;
  const storedPath = path.join(config.mediaDir, storedName);
  const thumbName = `${slug}.jpg`;

  try {
    recordJob(jobId, filename, "running", 62, "analyse du fichier…", uploaderId);
    await fs.promises.rename(tmpPath, storedPath);

    const meta = await probe(storedPath);
    const size = (await fs.promises.stat(storedPath)).size;

    recordJob(jobId, filename, "running", 84, "génération de la miniature…", uploaderId);
    let thumbPath: string | null = null;
    try {
      await extractThumbnail(storedPath, path.join(config.mediaDir, thumbName), Math.min(1, meta.duration_s / 2));
      thumbPath = thumbName;
    } catch (error) {
      app.log.warn({ err: error }, "miniature impossible — le clip reste lisible");
    }

    const settings = getSettings();
    const gameId = fields.game ? upsertGame(fields.game.trim().toLowerCase().replace(/\s+/g, "-"), fields.game.trim()) : null;
    const visibility = fields.visibility || settings.default_visibility || "link";
    const expiryDays = Number(settings.link_expiry_days) || 0;
    const shareExpires =
      visibility === "link" && expiryDays > 0
        ? new Date(Date.now() + expiryDays * 86_400_000).toISOString().slice(0, 19).replace("T", " ")
        : null;
    const info = db
      .prepare(
        `INSERT INTO clips (slug, code, title, description, game_id, uploader_id, file_path, thumb_path,
                            duration_s, width, height, fps, codec, bitrate_kbps, size_bytes, visibility, share_expires)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slug,
        code,
        fields.title || filename,
        fields.description,
        gameId,
        uploaderId,
        storedName,
        thumbPath,
        meta.duration_s,
        meta.width,
        meta.height,
        meta.fps,
        meta.codec,
        meta.bitrate_kbps,
        size,
        visibility,
        shareExpires,
      );

    // le champ est pré-rempli avec les tags par défaut : ce que le membre laisse
    // dans le formulaire fait foi, y compris s'il les a tous retirés
    setTags(Number(info.lastInsertRowid), fields.tags.split(","));
    recordJob(jobId, filename, "done", 100, `clip publié · /watch/${slug}`, uploaderId, Number(info.lastInsertRowid));
  } catch (error) {
    app.log.error({ err: error }, "traitement du clip échoué");
    recordJob(jobId, filename, "failed", 41, "traitement échoué — voir le journal du serveur");
    await fs.promises.rm(tmpPath, { force: true });
    if (fs.existsSync(tmpPath)) {
      return;
    }
  }
}

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post("/upload", { preHandler: requireUser, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const data = await request.file({ limits: { fileSize: config.maxUploadBytes } });
    if (!data) {
      return reply.redirect("/upload?error=fichier%20manquant");
    }
    const ext = path.extname(data.filename).toLowerCase();
    if (!ALLOWED.has(ext)) {
      return reply.redirect(`/upload?error=${encodeURIComponent(`format refusé : ${ext || "inconnu"} — attendu mp4, mkv, mov, webm`)}`);
    }

    const jobId = crypto.randomUUID();
    const tmpPath = path.join(config.mediaDir, `.incoming-${jobId}${ext}`);
    recordJob(jobId, data.filename, "running", 12, "réception du fichier…", request.user!.id);

    await pipeline(data.file, fs.createWriteStream(tmpPath));

    if (data.file.truncated) {
      await fs.promises.rm(tmpPath, { force: true });
      recordJob(jobId, data.filename, "failed", 41, `fichier trop volumineux (limite ${config.maxUploadBytes / 1024 ** 3} Go)`);
      return reply.redirect(`/upload?error=${encodeURIComponent("fichier trop volumineux")}`);
    }

    // les champs placés après le fichier ne sont parsés qu'une fois le flux consommé
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(data.fields)) {
      const raw = value as { value?: unknown };
      fields[key] =
        typeof raw?.value === "string"
          ? raw.value
          : Buffer.isBuffer(raw?.value)
            ? raw.value.toString("utf8")
            : "";
    }

    for (const key of ["title", "game", "tags", "description"]) {
      if ((fields[key] ?? "").length > 4000) {
        return reply.redirect(`/upload?error=${encodeURIComponent("champ trop long")}`);
      }
    }

    void runPipeline(app, jobId, data.filename, tmpPath, {
      title: fields.title ?? "",
      game: fields.game ?? "",
      tags: fields.tags ?? "",
      description: fields.description ?? "",
      visibility: fields.visibility ?? "link",
    }, request.user!.id);

    return reply.redirect("/upload?sent=1");
  });

  app.get("/api/jobs", { preHandler: requireUser }, async (request, reply) => {
    return reply.send(listJobs(request.user!, 8));
  });
}

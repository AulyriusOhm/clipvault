import type { FastifyInstance } from "fastify";
import { requireUser } from "../auth.ts";
import { baseContext } from "../context.ts";
import { getClip, incrementViews, listClips, listJobs, suggestedClips } from "../db.ts";

const PER_PAGE = 12;

function visibleTo(clip: { visibility: string; share_expires: string | null }, userId?: number): boolean {
  if (clip.visibility === "members") {
    return Boolean(userId);
  }
  if (clip.visibility === "link" && clip.share_expires) {
    return new Date(`${clip.share_expires.replace(" ", "T")}Z`).getTime() > Date.now();
  }
  return true;
}

export async function pageRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (_request, reply) => reply.redirect("/library"));

  app.get("/library", async (request, reply) => {
    const q = request.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(q.page ?? 1) || 1);
    const options = {
      search: (q.q ?? "").trim(),
      game: q.game ?? "",
      tag: q.tag ?? "",
      sort: q.sort ?? "recent",
      page,
      perPage: PER_PAGE,
      viewerId: request.user?.id,
    };
    const { clips, total } = listClips(options);
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));

    return reply.view("library.ejs", {
      ...baseContext(request),
      title: "Bibliothèque — ClipVault",
      clips,
      total,
      pages,
      page,
      perPage: PER_PAGE,
      query: options,
      hasFilters: Boolean(options.search || options.game || options.tag),
    });
  });

  app.get("/watch/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const clip = getClip(slug);
    if (!clip || clip.deleted_at) {
      reply.code(404);
      return reply.view("error.ejs", {
        ...baseContext(request),
        title: "Clip introuvable — ClipVault",
        heading: "Ce clip n'est plus là",
        sub: `/watch/${slug} — 404`,
        body: clip ? "Ce clip a été supprimé. Le fichier et ses dérivés ont été effacés du disque." : "Aucun clip ne porte cet identifiant sur l'instance.",
        actions: [
          { href: "/", label: "Voir la bibliothèque" },
          { href: "/upload", label: "Déposer un clip" },
        ],
      });
    }
    if (!visibleTo(clip, request.user?.id)) {
      return reply.redirect(`/login?next=${encodeURIComponent(`/watch/${slug}`)}`);
    }
    incrementViews(clip.id);
    return reply.view("watch.ejs", {
      ...baseContext(request),
      title: `${clip.title} — ClipVault`,
      clip,
      suggested: suggestedClips(clip.game_id, clip.id, request.user?.id, 4),
    });
  });

  app.get("/c/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const clip = getClip(slug);
    if (!clip || clip.deleted_at) {
      reply.code(404);
      return reply.view("error.ejs", {
        ...baseContext(request),
        title: "Lien invalide — ClipVault",
        heading: "Ce lien ne mène plus nulle part",
        sub: `/c/${slug} — 404`,
        body: "Le clip a été supprimé ou le lien a été révoqué par son auteur.",
        actions: [{ href: "/login", label: "Se connecter" }],
      });
    }
    if (clip.visibility === "members" && !request.user) {
      return reply.redirect(`/login?next=${encodeURIComponent(`/c/${slug}`)}`);
    }
    if (!visibleTo(clip, request.user?.id)) {
      reply.code(410);
      return reply.view("error.ejs", {
        ...baseContext(request),
        title: "Lien expiré — ClipVault",
        heading: "Ce lien de partage a expiré",
        sub: `/c/${slug} — 410`,
        body: "La durée de partage définie par l'auteur est dépassée. Demandez-lui un nouveau lien.",
        actions: [{ href: "/library", label: "Voir la bibliothèque" }],
      });
    }
    incrementViews(clip.id);
    return reply.view("share.ejs", {
      ...baseContext(request),
      title: `${clip.title} — ClipVault`,
      clip,
      suggested: suggestedClips(clip.game_id, clip.id, request.user?.id, 4),
    });
  });

  app.get("/upload", { preHandler: requireUser }, async (request, reply) => {
    return reply.view("upload.ejs", {
      ...baseContext(request),
      title: "Dépôt — ClipVault",
      jobs: listJobs(request.user!),
      error: (request.query as Record<string, string | undefined>).error,
    });
  });
}

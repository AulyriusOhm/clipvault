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
      title: "Library — ClipVault",
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
        title: "Clip not found — ClipVault",
        heading: "This clip is gone",
        sub: `/watch/${slug} — 404`,
        body: clip ? "This clip was deleted. The file and its derivatives were erased from disk." : "No clip carries this identifier on the instance.",
        actions: [
          { href: "/", label: "View the library" },
          { href: "/upload", label: "Upload a clip" },
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
        title: "Invalid link — ClipVault",
        heading: "This link leads nowhere",
        sub: `/c/${slug} — 404`,
        body: "The clip was deleted or the link was revoked by its author.",
        actions: [{ href: "/login", label: "Sign in" }],
      });
    }
    if (clip.visibility === "members" && !request.user) {
      return reply.redirect(`/login?next=${encodeURIComponent(`/c/${slug}`)}`);
    }
    if (!visibleTo(clip, request.user?.id)) {
      reply.code(410);
      return reply.view("error.ejs", {
        ...baseContext(request),
        title: "Expired link — ClipVault",
        heading: "This share link has expired",
        sub: `/c/${slug} — 410`,
        body: "The share duration set by the author has passed. Ask them for a new link.",
        actions: [{ href: "/library", label: "View the library" }],
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
      title: "Upload — ClipVault",
      jobs: listJobs(request.user!),
      error: (request.query as Record<string, string | undefined>).error,
    });
  });
}

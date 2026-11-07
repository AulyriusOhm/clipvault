import type { FastifyRequest } from "fastify";
import { config } from "./config.ts";
import { getSettings, listGames, listTags, stats } from "./db.ts";
import { THEMES, resolveTheme } from "./theme.ts";

export function baseContext(request: FastifyRequest): Record<string, unknown> {
  const settings = getSettings();
  const theme = resolveTheme(settings.theme);
  const forwarded = request.headers["x-forwarded-proto"];
  const proto = (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? request.protocol;
  const baseUrl = (settings.public_url || `${proto}://${request.headers.host}`).replace(/\/+$/, "");
  return {
    user: request.user ?? null,
    settings,
    theme,
    themes: THEMES,
    baseUrl,
    instance: settings.instance_name || config.instanceName,
    games: listGames(request.user?.id),
    tags: listTags(),
    counting: stats(request.user?.id),
    authMode: config.auth.mode,
    currentUrl: request.url,
  };
}

/** Tags offered up front in the upload and edit forms. */
export const COMMON_TAGS = [
  "fps",
  "ace",
  "clutch",
  "headshot",
  "multikill",
  "ranked",
  "speedrun",
  "no-hit",
  "boss",
  "extraction",
  "funny",
  "fail",
  "glitch",
  "4k",
  "60fps",
  "tuto",
];

/** Merges the tags already used by the instance with the base list. */
export function tagSuggestions(existing: string[], configured = "", limit = 24): string[] {
  const base = configured
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of [...existing, ...(base.length ? base : COMMON_TAGS)]) {
    const clean = tag.trim().toLowerCase();
    if (!clean || seen.has(clean)) {
      continue;
    }
    seen.add(clean);
    result.push(clean);
    if (result.length >= limit) {
      break;
    }
  }
  return result;
}

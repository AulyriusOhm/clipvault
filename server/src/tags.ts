/** Tags proposés d'emblée dans les formulaires de dépôt et d'édition. */
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

/** Fusionne les tags déjà utilisés par l'instance avec la liste de base. */
export function tagSuggestions(existing: string[], limit = 16): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of [...existing, ...COMMON_TAGS]) {
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

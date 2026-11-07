import { config } from "./config.ts";
import { createUser, db, ensureDir, setTags, upsertGame } from "./db.ts";

const GAMES = [
  ["valorant", "VALORANT"],
  ["rocket-league", "Rocket League"],
  ["elden-ring", "Elden Ring"],
  ["counter-strike-2", "Counter-Strike 2"],
  ["helldivers-2", "Helldivers 2"],
  ["apex-legends", "Apex Legends"],
  ["deep-rock-galactic", "Deep Rock Galactic"],
  ["trackmania", "TrackMania"],
];

interface SeedClip {
  title: string;
  game: string;
  days: number;
  duration: number;
  size: number;
  width: number;
  height: number;
  uploader: number;
  tags: string[];
  visibility: string;
  description: string;
}

const UPLOADERS = ["kael_", "novabyte", "solstice", "mirakel", "bram"];

const CLIPS: SeedClip[] = [
  { title: "Ace à l'Op — clutch 1v3 sur Ascent", game: "valorant", days: 0, duration: 92, size: 287 * 1024 * 1024, width: 2560, height: 1440, uploader: 0, tags: ["clutch", "ace", "op", "ascent"], visibility: "link", description: "Dernière manche, 2 contre 4. Reprise de l'Op sur le rotate mid, le premier tombe à 0:11, puis clutch 1v3 dans les vingt dernières secondes." },
  { title: "Airdribble depuis la moitié adverse (ceiling reset)", game: "rocket-league", days: 0, duration: 47, size: 94 * 1024 * 1024, width: 1920, height: 1080, uploader: 1, tags: ["airdribble", "ceiling", "ranked"], visibility: "public", description: "Reset plafond à 4 secondes, dribble aérien sur toute la longueur." },
  { title: "Malenia, phase 2 — sans coup pris", game: "elden-ring", days: 1, duration: 194, size: 1228 * 1024 * 1024, width: 3440, height: 1440, uploader: 2, tags: ["no-hit", "boss", "malenia"], visibility: "link", description: "Tentative 47. Aucun coup encaissé, Waterfowl dansé à la roulade." },
  { title: "Ace pistol round — Deagle sur Mirage", game: "counter-strike-2", days: 2, duration: 38, size: 76 * 1024 * 1024, width: 1920, height: 1080, uploader: 3, tags: ["ace", "pistol", "deagle", "mirage"], visibility: "link", description: "Cinq tirs, cinq têtes sur le round pistolet." },
  { title: "Extraction à 0:12 — Helldive impossible", game: "helldivers-2", days: 3, duration: 125, size: 421 * 1024 * 1024, width: 2560, height: 1440, uploader: 4, tags: ["extraction", "helldive", "clutch"], visibility: "public", description: "Deux renforts restants, peloton au sol, la navette décolle avec 12 secondes d'avance." },
  { title: "1v9 avec Wraith — fin de partie", game: "apex-legends", days: 4, duration: 68, size: 158 * 1024 * 1024, width: 1920, height: 1080, uploader: 0, tags: ["1v9", "wraith", "clutch"], visibility: "link", description: "Trois équipes au ring final, phase et sortie de zone à 3 PV." },
  { title: "Auteur-fantôme — top 1 France sur Valley", game: "trackmania", days: 5, duration: 42, size: 61 * 1024 * 1024, width: 1920, height: 1080, uploader: 1, tags: ["author", "time-attack"], visibility: "public", description: "Auteur médaille sur Valley, 0,04 s devant le deuxième." },
  { title: "La cinématique du campement — nuit 14", game: "elden-ring", days: 6, duration: 251, size: 1_610 * 1024 * 1024, width: 2560, height: 1440, uploader: 2, tags: ["ambiance", "4k"], visibility: "members", description: "Le campement au complet, dialogues de nuit déclenchés dans l'ordre." },
  { title: "Shatter + Graviton — team wipe enchaîné", game: "apex-legends", days: 7, duration: 51, size: 84 * 1024 * 1024, width: 1920, height: 1080, uploader: 3, tags: ["shatter", "graviton", "wipe"], visibility: "link", description: "Deux ultimes enchaînés dans le même couloir." },
  { title: "Dreadnought en solo — deep dive 3 étoiles", game: "deep-rock-galactic", days: 9, duration: 383, size: 742 * 1024 * 1024, width: 2560, height: 1440, uploader: 4, tags: ["solo", "dreadnought"], visibility: "members", description: "Trois Dreadnoughts enchaînés sans redescendre au pod." },
  { title: "Retake A — spraydown à travers la fumée", game: "counter-strike-2", days: 12, duration: 41, size: 96 * 1024 * 1024, width: 1920, height: 1080, uploader: 1, tags: ["retake", "spray", "smoke"], visibility: "link", description: "Trois à travers la fumée au sound cue, sans visuel." },
  { title: "Flip reset manqué… puis le but de la gagne", game: "rocket-league", days: 18, duration: 29, size: 58 * 1024 * 1024, width: 1920, height: 1080, uploader: 0, tags: ["flip-reset", "overtime", "funny"], visibility: "public", description: "Le geste échoue, la balle traîne, but en overtime." },
  { title: "Ace à l'Op — clutch 1v4 sur Haven", game: "valorant", days: 24, duration: 104, size: 312 * 1024 * 1024, width: 2560, height: 1440, uploader: 0, tags: ["clutch", "ace", "haven"], visibility: "link", description: "1v4 sans sortie d'utilitaire, quatre duels gagnés au corps à corps." },
  { title: "Le saut de la falaise — 1 h 12 de grind", game: "elden-ring", days: 31, duration: 212, size: 980 * 1024 * 1024, width: 1920, height: 1080, uploader: 2, tags: ["speedrun", "skip"], visibility: "link", description: "Sequence break validée après 72 minutes d'essais." },
];

const user = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
if (user.n === 0) {
  createUser("dev:kael_", "kael_", "Kael", "admin");
  for (const name of UPLOADERS.slice(1)) {
    createUser(`seed:${name}`, name, name, "member");
  }
  console.log(`${UPLOADERS.length} comptes créés`);
}

if (process.argv.includes("--users-only")) {
  console.log("mode utilisateurs seulement : aucun clip de démonstration inséré");
  process.exit(0);
}

const existing = db.prepare("SELECT COUNT(*) AS n FROM clips").get() as { n: number };
if (existing.n > 0) {
  console.log(`${existing.n} clips déjà présents — rien à faire.`);
  process.exit(0);
}

ensureDir("seed-thumbs");

const uploaders = db.prepare("SELECT id, username FROM users ORDER BY id").all() as { id: number; username: string }[];
const gameIds = new Map<string, number>(GAMES.map(([slug, name]) => [slug as string, upsertGame(slug as string, name as string)]));

const insert = db.prepare(
  `INSERT INTO clips (slug, code, title, description, game_id, uploader_id, file_path, thumb_path,
                      duration_s, width, height, fps, codec, bitrate_kbps, size_bytes, visibility, views, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
);

let code = 200;
for (const clip of [...CLIPS].reverse()) {
  code += 1;
  const slug = `${code}-${clip.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)}`;
  const uploader = uploaders[clip.uploader % uploaders.length]!;
  const info = insert.run(
    slug,
    code,
    clip.title,
    clip.description,
    gameIds.get(clip.game) ?? null,
    uploader.id,
    `seed-${slug}.mp4`,
    clip.duration,
    clip.width,
    clip.height,
    60,
    "h264",
    Math.round((clip.size * 8) / 1024 / Math.max(1, clip.duration)),
    clip.size,
    clip.visibility,
    Math.floor(Math.random() * 40),
    `-${clip.days} days`,
  );
  setTags(Number(info.lastInsertRowid), clip.tags);
}

console.log(`${CLIPS.length} clips de démonstration insérés dans ${config.dbFile}`);
console.log("Les vidéos et miniatures de démonstration sont absentes : la grille affichera des vignettes vides jusqu'au premier vrai dépôt.");

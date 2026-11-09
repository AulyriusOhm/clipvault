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
  { title: "Operator ace — 1v3 clutch on Ascent", game: "valorant", days: 0, duration: 92, size: 287 * 1024 * 1024, width: 2560, height: 1440, uploader: 0, tags: ["clutch", "ace", "op", "ascent"], visibility: "link", description: "Last round, 2 against 4. Operator picked back up on the mid rotate, the first one drops at 0:11, then a 1v3 clutch inside the final twenty seconds." },
  { title: "Airdribble from the far half (ceiling reset)", game: "rocket-league", days: 0, duration: 47, size: 94 * 1024 * 1024, width: 1920, height: 1080, uploader: 1, tags: ["airdribble", "ceiling", "ranked"], visibility: "public", description: "Ceiling reset at 4 seconds, air dribble over the whole length of the field." },
  { title: "Malenia, phase 2 — no hits taken", game: "elden-ring", days: 1, duration: 194, size: 1228 * 1024 * 1024, width: 3440, height: 1440, uploader: 2, tags: ["no-hit", "boss", "malenia"], visibility: "link", description: "Attempt 47. Not a single hit taken, Waterfowl danced through on rolls." },
  { title: "Ace pistol round — Deagle on Mirage", game: "counter-strike-2", days: 2, duration: 38, size: 76 * 1024 * 1024, width: 1920, height: 1080, uploader: 3, tags: ["ace", "pistol", "deagle", "mirage"], visibility: "link", description: "Five shots, five heads in the pistol round." },
  { title: "Extraction at 0:12 — impossible Helldive", game: "helldivers-2", days: 3, duration: 125, size: 421 * 1024 * 1024, width: 2560, height: 1440, uploader: 4, tags: ["extraction", "helldive", "clutch"], visibility: "public", description: "Two reinforcements left, squad on the ground, the shuttle lifts off with 12 seconds to spare." },
  { title: "1v9 with Wraith — end of the match", game: "apex-legends", days: 4, duration: 68, size: 158 * 1024 * 1024, width: 1920, height: 1080, uploader: 0, tags: ["1v9", "wraith", "clutch"], visibility: "link", description: "Three teams in the final ring, phased and out of the zone at 3 HP." },
  { title: "Ghost author — #1 in France on Valley", game: "trackmania", days: 5, duration: 42, size: 61 * 1024 * 1024, width: 1920, height: 1080, uploader: 1, tags: ["author", "time-attack"], visibility: "public", description: "Author medal on Valley, 0.04 s ahead of second place." },
  { title: "The camp cutscene — night 14", game: "elden-ring", days: 6, duration: 251, size: 1_610 * 1024 * 1024, width: 2560, height: 1440, uploader: 2, tags: ["ambiance", "4k"], visibility: "members", description: "The whole camp gathered, night dialogues triggered in order." },
  { title: "Shatter + Graviton — chained team wipe", game: "apex-legends", days: 7, duration: 51, size: 84 * 1024 * 1024, width: 1920, height: 1080, uploader: 3, tags: ["shatter", "graviton", "wipe"], visibility: "link", description: "Two ultimates chained in the same corridor." },
  { title: "Dreadnought solo — 3-star deep dive", game: "deep-rock-galactic", days: 9, duration: 383, size: 742 * 1024 * 1024, width: 2560, height: 1440, uploader: 4, tags: ["solo", "dreadnought"], visibility: "members", description: "Three Dreadnoughts in a row without going back down to the pod." },
  { title: "A retake — spraydown through the smoke", game: "counter-strike-2", days: 12, duration: 41, size: 96 * 1024 * 1024, width: 1920, height: 1080, uploader: 1, tags: ["retake", "spray", "smoke"], visibility: "link", description: "Three through the smoke on the sound cue, with no vision at all." },
  { title: "Missed flip reset… then the winning goal", game: "rocket-league", days: 18, duration: 29, size: 58 * 1024 * 1024, width: 1920, height: 1080, uploader: 0, tags: ["flip-reset", "overtime", "funny"], visibility: "public", description: "The move fails, the ball lingers, goal in overtime." },
  { title: "Operator ace — 1v4 clutch on Haven", game: "valorant", days: 24, duration: 104, size: 312 * 1024 * 1024, width: 2560, height: 1440, uploader: 0, tags: ["clutch", "ace", "haven"], visibility: "link", description: "1v4 without spending any utility, four duels won up close." },
  { title: "The cliff jump — 1 h 12 of grinding", game: "elden-ring", days: 31, duration: 212, size: 980 * 1024 * 1024, width: 1920, height: 1080, uploader: 2, tags: ["speedrun", "skip"], visibility: "link", description: "Sequence break landed after 72 minutes of attempts." },
];

const user = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
if (user.n === 0) {
  createUser("dev:kael_", "kael_", "Kael", "admin");
  for (const name of UPLOADERS.slice(1)) {
    createUser(`seed:${name}`, name, name, "member");
  }
  console.log(`${UPLOADERS.length} accounts created`);
}

if (process.argv.includes("--users-only")) {
  console.log("users-only mode: no demo clip inserted");
  process.exit(0);
}

const existing = db.prepare("SELECT COUNT(*) AS n FROM clips").get() as { n: number };
if (existing.n > 0) {
  console.log(`${existing.n} clips already present — nothing to do.`);
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

console.log(`${CLIPS.length} demo clips inserted into ${config.dbFile}`);
console.log("The demo videos and thumbnails are missing: the grid will show empty thumbnails until the first real upload.");

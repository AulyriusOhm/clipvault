import fs from "node:fs";
import path from "node:path";
import { db, ensureDir, getSettings, nextCode, setTags, upsertGame } from "./db.ts";
import { config } from "./config.ts";
import { extractThumbnail, probe } from "./media.ts";

const source = process.argv[2];
if (!source) {
  console.error("usage: tsx src/import.ts <videos-folder> [player-name]");
  process.exit(1);
}
const uploaderName = process.argv[3] ?? "import";

const GAMES: [RegExp, string, string][] = [
  [/battlefield/i, "battlefield", "Battlefield"],
  [/rocket.?league|rl_/i, "rocket-league", "Rocket League"],
  [/valorant|val_/i, "valorant", "VALORANT"],
  [/counter.?strike|cs2|de_|csgo/i, "counter-strike-2", "Counter-Strike 2"],
  [/apex/i, "apex-legends", "Apex Legends"],
  [/elden/i, "elden-ring", "Elden Ring"],
  [/helldiver/i, "helldivers-2", "Helldivers 2"],
  [/minecraft/i, "minecraft", "Minecraft"],
  [/fortnite/i, "fortnite", "Fortnite"],
  [/overwatch/i, "overwatch", "Overwatch"],
];

const VIDEO = /\.(mp4|mkv|mov|webm)$/i;

function cleanTitle(file: string): string {
  const base = path.basename(file, path.extname(file));
  return base
    .replace(/[_]+/g, " ")
    .replace(/\s*[-‐]\s*/g, " — ")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .slice(0, 90);
}

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

function guessGame(file: string): [string, string] | null {
  for (const [pattern, slug, name] of GAMES) {
    if (pattern.test(file)) {
      return [slug, name];
    }
  }
  return null;
}

const user = db.prepare("SELECT id, username FROM users WHERE username = ?").get(uploaderName) as
  | { id: number; username: string }
  | undefined;
if (!user) {
  console.error(`unknown user "${uploaderName}" — run db:seed or pick an existing member`);
  process.exit(1);
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full));
    } else if (VIDEO.test(entry.name)) {
      found.push(full);
    }
  }
  return found.sort();
}

const files = walk(source);
console.log(`${files.length} video file(s) in ${source}`);

const exists = db.prepare("SELECT 1 FROM clips WHERE source_path = ?");
const insert = db.prepare(
  `INSERT INTO clips (slug, code, title, description, game_id, uploader_id, file_path, thumb_path,
                      duration_s, width, height, fps, codec, bitrate_kbps, size_bytes, visibility, source_path)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

ensureDir("imported");
let imported = 0;
let skipped = 0;
const failures: string[] = [];

for (const file of files) {
  if (exists.get(file)) {
    skipped += 1;
    continue;
  }
  const title = cleanTitle(file);
  const game = guessGame(file);
  try {
    const meta = await probe(file);
    const code = nextCode();
    const slug = slugify(title, code);
    const thumbName = `${slug}.jpg`;
    await extractThumbnail(file, path.join(config.mediaDir, thumbName), Math.min(1, meta.duration_s / 2));
    const size = fs.statSync(file).size;
    const gameId = game ? upsertGame(game[0], game[1]) : null;

    const linkName = `import-${slug}${path.extname(file).toLowerCase()}`;
    const linkPath = path.join(config.mediaDir, linkName);
    if (!fs.existsSync(linkPath)) {
      fs.symlinkSync(path.resolve(file), linkPath);
    }

    const info = insert.run(
      slug,
      code,
      title,
      `Imported from ${path.basename(source)}`,
      gameId,
      user.id,
      linkName,
      thumbName,
      meta.duration_s,
      meta.width,
      meta.height,
      meta.fps,
      meta.codec,
      meta.bitrate_kbps,
      size,
      "members",
      file,
    );
    const defaults = (getSettings().default_tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
    setTags(Number(info.lastInsertRowid), defaults);
    imported += 1;
    console.log(`  + #${String(code).padStart(4, "0")} ${title} — ${Math.round(meta.duration_s)} s, ${(size / 1024 / 1024).toFixed(1)} MB${game ? ` · ${game[1]}` : ""}`);
  } catch (error) {
    failures.push(`${path.basename(file)}: ${error instanceof Error ? error.message : error}`);
  }
}

console.log(`\n${imported} imported · ${skipped} already present · ${failures.length} failed`);
for (const failure of failures) {
  console.log("  ! " + failure);
}

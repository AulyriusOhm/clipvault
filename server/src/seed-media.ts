import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { db } from "./db.ts";
import { config } from "./config.ts";
import { extractThumbnail, probe } from "./media.ts";

const PALETTE = [
  ["0x7c2432", "0x1b1620"],
  ["0x2a6db5", "0x12263f"],
  ["0x8a6a2f", "0x241a10"],
  ["0xb07a2a", "0x20180e"],
  ["0xc2a13c", "0x2a2410"],
  ["0xa63b2a", "0x1e1210"],
  ["0x4c7c39", "0x1a2416"],
  ["0x7150c8", "0x1b1826"],
];

function pick(slug: string): [string, string] {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return PALETTE[h % PALETTE.length] as [string, string];
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${bin} ${code}: ${err.slice(-300)}`))));
  });
}

interface Row {
  id: number;
  slug: string;
  code: number;
  title: string;
  file_path: string;
  duration_s: number;
}

const rows = db
  .prepare("SELECT id, slug, code, title, file_path, duration_s FROM clips WHERE file_path LIKE 'seed-%' ORDER BY id")
  .all() as Row[];

fs.mkdirSync(config.mediaDir, { recursive: true });
let baked = 0;

for (const row of rows) {
  const videoName = `seed-${row.slug}.mp4`;
  const thumbName = `seed-${row.slug}.jpg`;
  const videoPath = path.join(config.mediaDir, videoName);
  const thumbPath = path.join(config.mediaDir, thumbName);

  if (fs.existsSync(videoPath) && fs.existsSync(thumbPath)) {
    continue;
  }

  const [c0, c1] = pick(row.slug);
  const seconds = Math.min(Math.max(4, Math.round(row.duration_s)), 12);

  await run("ffmpeg", [
    "-v", "error", "-y",
    "-f", "lavfi",
    "-i", `gradients=s=1280x720:d=${seconds}:c0=${c0}:c1=${c1}:speed=0.012:rate=60`,
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    videoPath,
  ]);

  await extractThumbnail(videoPath, thumbPath, Math.min(1, seconds / 3));

  const meta = await probe(videoPath);
  const size = fs.statSync(videoPath).size;

  db.prepare(
    `UPDATE clips SET file_path = ?, thumb_path = ?, duration_s = ?, width = ?, height = ?, fps = ?,
                      codec = ?, bitrate_kbps = ?, size_bytes = ? WHERE id = ?`,
  ).run(
    videoName,
    thumbName,
    meta.duration_s,
    meta.width,
    meta.height,
    meta.fps,
    meta.codec,
    meta.bitrate_kbps,
    size,
    row.id,
  );

  baked += 1;
  console.log(`  #${String(row.code).padStart(4, "0")} ${videoName} — ${seconds} s, ${(size / 1024).toFixed(0)} KB`);
}

console.log(`${baked} demo clip(s) made playable in ${config.mediaDir}`);

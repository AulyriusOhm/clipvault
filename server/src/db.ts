import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config.ts";

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.mediaDir, { recursive: true });

export const db = new Database(config.dbFile);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY,
    subject      TEXT NOT NULL UNIQUE,
    username     TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'member',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS games (
    id   INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS clips (
    id            INTEGER PRIMARY KEY,
    slug          TEXT NOT NULL UNIQUE,
    code          INTEGER NOT NULL,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    game_id       INTEGER REFERENCES games(id),
    uploader_id   INTEGER REFERENCES users(id),
    file_path     TEXT NOT NULL,
    thumb_path    TEXT,
    duration_s    REAL NOT NULL DEFAULT 0,
    width         INTEGER NOT NULL DEFAULT 0,
    height        INTEGER NOT NULL DEFAULT 0,
    fps           REAL NOT NULL DEFAULT 0,
    codec         TEXT NOT NULL DEFAULT '',
    bitrate_kbps  INTEGER NOT NULL DEFAULT 0,
    size_bytes    INTEGER NOT NULL DEFAULT 0,
    visibility    TEXT NOT NULL DEFAULT 'link',
    views         INTEGER NOT NULL DEFAULT 0,
    share_expires TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at    TEXT,
    source_path   TEXT,
    updated_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS clip_tags (
    clip_id INTEGER NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (clip_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id         TEXT PRIMARY KEY,
    owner_id   INTEGER REFERENCES users(id),
    filename   TEXT NOT NULL,
    state      TEXT NOT NULL,
    pct        INTEGER NOT NULL DEFAULT 0,
    detail     TEXT NOT NULL DEFAULT '',
    clip_id    INTEGER REFERENCES clips(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invites (
    id         INTEGER PRIMARY KEY,
    token      TEXT NOT NULL UNIQUE,
    note       TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    used_by    INTEGER REFERENCES users(id),
    used_at    TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_clips_created ON clips(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_clips_game ON clips(game_id);
`);

const jobColumns = (db.prepare("PRAGMA table_info(jobs)").all() as { name: string }[]).map((c) => c.name);
if (!jobColumns.includes("owner_id")) {
  db.exec("ALTER TABLE jobs ADD COLUMN owner_id INTEGER");
}

const columns = (db.prepare("PRAGMA table_info(clips)").all() as { name: string }[]).map((c) => c.name);

if (!columns.includes("source_path")) {
  db.exec("ALTER TABLE clips ADD COLUMN source_path TEXT");
}

if (!columns.includes("updated_at")) {
  db.exec("ALTER TABLE clips ADD COLUMN updated_at TEXT");
}

export interface User {
  id: number;
  subject: string;
  username: string;
  display_name: string;
  role: string;
}

export interface Game {
  id: number;
  slug: string;
  name: string;
  count: number;
}

export interface Clip {
  id: number;
  slug: string;
  code: number;
  title: string;
  description: string;
  game_id: number | null;
  game_name: string | null;
  game_slug: string | null;
  uploader: string;
  uploader_id: number | null;
  file_path: string;
  thumb_path: string | null;
  duration_s: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate_kbps: number;
  size_bytes: number;
  visibility: string;
  views: number;
  share_expires: string | null;
  created_at: string;
  deleted_at: string | null;
  source_path: string | null;
  updated_at: string | null;
  tags: string;
}

export function isMember(user: User | undefined): boolean {
  return Boolean(user);
}

export function findBySubject(subject: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE subject = ?").get(subject) as User | undefined;
}

export function createUser(subject: string, username: string, displayName: string, role = "member"): User {
  const info = db
    .prepare("INSERT INTO users (subject, username, display_name, role) VALUES (?, ?, ?, ?)")
    .run(subject, username, displayName, role);
  return db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid) as User;
}

export function listGames(viewerId?: number): Game[] {
  return db
    .prepare(
      `SELECT g.id, g.slug, g.name, COUNT(c.id) AS count
         FROM games g
         LEFT JOIN clips c ON c.game_id = g.id
              AND c.deleted_at IS NULL
              AND (c.visibility = 'public'
                   OR (c.visibility = 'members' AND ? = 1)
                   OR c.uploader_id = ?)
        GROUP BY g.id
        HAVING count > 0
        ORDER BY count DESC, g.name`,
    )
    .all(viewerId ? 1 : 0, viewerId ?? -1) as Game[];
}

export function listTags(): string[] {
  return (db.prepare("SELECT name FROM tags ORDER BY name").all() as { name: string }[]).map((r) => r.name);
}

export interface ListOptions {
  search: string;
  game: string;
  tag: string;
  sort: string;
  page: number;
  perPage: number;
  viewerId?: number;
}

const SORTS: Record<string, string> = {
  recent: "c.created_at DESC",
  old: "c.created_at ASC",
  duration: "c.duration_s DESC",
  size: "c.size_bytes DESC",
  alpha: "c.title COLLATE NOCASE ASC",
};

export function listClips(options: ListOptions): { clips: Clip[]; total: number } {
  const where: string[] = ["c.deleted_at IS NULL"];
  const params: unknown[] = [];

  where.push(
    "(c.visibility = 'public' OR (c.visibility = 'members' AND ? = 1) OR c.uploader_id = ?)",
  );
  params.push(options.viewerId ? 1 : 0, options.viewerId ?? -1);

  if (options.game) {
    where.push("g.slug = ?");
    params.push(options.game);
  }
  if (options.tag) {
    where.push("EXISTS (SELECT 1 FROM clip_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.clip_id = c.id AND t.name = ?)");
    params.push(options.tag);
  }
  if (options.search) {
    where.push("(c.title LIKE ? OR g.name LIKE ? OR c.description LIKE ?)");
    const like = `%${options.search}%`;
    params.push(like, like, like);
  }

  const clause = where.join(" AND ");
  const total = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM clips c LEFT JOIN games g ON g.id = c.game_id WHERE ${clause}`)
      .get(...params) as { n: number }
  ).n;

  const rows = db
    .prepare(
      `SELECT c.*, g.name AS game_name, g.slug AS game_slug,
              u.username AS uploader,
              COALESCE((SELECT group_concat(t.name, ' ') FROM clip_tags ct
                          JOIN tags t ON t.id = ct.tag_id WHERE ct.clip_id = c.id), '') AS tags
         FROM clips c
         LEFT JOIN games g ON g.id = c.game_id
         LEFT JOIN users u ON u.id = c.uploader_id
        WHERE ${clause}
        ORDER BY ${SORTS[options.sort] ?? SORTS.recent}
        LIMIT ? OFFSET ?`,
    )
    .all(...params, options.perPage, (options.page - 1) * options.perPage) as Clip[];

  return { clips: rows, total };
}

export function getClip(slug: string): Clip | undefined {
  return db
    .prepare(
      `SELECT c.*, g.name AS game_name, g.slug AS game_slug,
              u.username AS uploader,
              COALESCE((SELECT group_concat(t.name, ' ') FROM clip_tags ct
                          JOIN tags t ON t.id = ct.tag_id WHERE ct.clip_id = c.id), '') AS tags
         FROM clips c
         LEFT JOIN games g ON g.id = c.game_id
         LEFT JOIN users u ON u.id = c.uploader_id
        WHERE c.slug = ?`,
    )
    .get(slug) as Clip | undefined;
}

export function suggestedClips(gameId: number | null, excludeId: number, viewerId?: number, limit = 4): Clip[] {
  return db
    .prepare(
      `SELECT c.*, g.name AS game_name, g.slug AS game_slug, u.username AS uploader,
              COALESCE((SELECT group_concat(t.name, ' ') FROM clip_tags ct
                          JOIN tags t ON t.id = ct.tag_id WHERE ct.clip_id = c.id), '') AS tags
         FROM clips c
         LEFT JOIN games g ON g.id = c.game_id
         LEFT JOIN users u ON u.id = c.uploader_id
        WHERE c.deleted_at IS NULL
          AND c.id != ?
          AND (c.visibility = 'public' OR (c.visibility = 'members' AND ? = 1) OR c.uploader_id = ?)
        ORDER BY (c.game_id = ?) DESC, c.created_at DESC
        LIMIT ?`,
    )
    .all(excludeId, viewerId ? 1 : 0, viewerId ?? -1, gameId, limit) as Clip[];
}

export function publicHighlights(limit = 3): Clip[] {
  return db
    .prepare(
      `SELECT c.*, g.name AS game_name, g.slug AS game_slug, u.username AS uploader,
              COALESCE((SELECT group_concat(t.name, ' ') FROM clip_tags ct
                          JOIN tags t ON t.id = ct.tag_id WHERE ct.clip_id = c.id), '') AS tags
         FROM clips c
         LEFT JOIN games g ON g.id = c.game_id
         LEFT JOIN users u ON u.id = c.uploader_id
        WHERE c.deleted_at IS NULL AND c.visibility = 'public'
        ORDER BY c.created_at DESC
        LIMIT ?`,
    )
    .all(limit) as Clip[];
}

export function stats(viewerId?: number): { clips: number; games: number; members: number; bytes: number } {
  const filter = `deleted_at IS NULL AND (visibility = 'public' OR (visibility = 'members' AND ? = 1) OR uploader_id = ?)`;
  const row = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM clips WHERE ${filter}) AS clips,
              (SELECT COUNT(DISTINCT game_id) FROM clips WHERE ${filter}) AS games,
              (SELECT COUNT(*) FROM users) AS members,
              (SELECT COALESCE(SUM(size_bytes), 0) FROM clips WHERE ${filter}) AS bytes`,
    )
    .get(viewerId ? 1 : 0, viewerId ?? -1, viewerId ? 1 : 0, viewerId ?? -1, viewerId ? 1 : 0, viewerId ?? -1) as {
      clips: number;
      games: number;
      members: number;
      bytes: number;
    };
  return row;
}

export function incrementViews(id: number): void {
  db.prepare("UPDATE clips SET views = views + 1 WHERE id = ?").run(id);
}

export function softDelete(id: number): void {
  db.prepare("UPDATE clips SET deleted_at = datetime('now') WHERE id = ?").run(id);
}

export function upsertGame(slug: string, name: string): number {
  db.prepare("INSERT INTO games (slug, name) VALUES (?, ?) ON CONFLICT(slug) DO UPDATE SET name = excluded.name").run(slug, name);
  return (db.prepare("SELECT id FROM games WHERE slug = ?").get(slug) as { id: number }).id;
}

export function setTags(clipId: number, names: string[]): void {
  db.prepare("DELETE FROM clip_tags WHERE clip_id = ?").run(clipId);
  for (const raw of names) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    db.prepare("INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING").run(name);
    const tag = db.prepare("SELECT id FROM tags WHERE name = ?").get(name) as { id: number };
    db.prepare("INSERT INTO clip_tags (clip_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING").run(clipId, tag.id);
  }
}

export function nextCode(): number {
  const row = db.prepare("SELECT COALESCE(MAX(code), 200) AS n FROM clips").get() as { n: number };
  return row.n + 1;
}

export function recordJob(
  id: string,
  filename: string,
  state: string,
  pct: number,
  detail: string,
  ownerId?: number,
  clipId?: number,
): void {
  db.prepare(
    `INSERT INTO jobs (id, filename, state, pct, detail, owner_id, clip_id) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET state = excluded.state, pct = excluded.pct, detail = excluded.detail,
                                   owner_id = COALESCE(excluded.owner_id, jobs.owner_id),
                                   clip_id = COALESCE(excluded.clip_id, jobs.clip_id)`,
  ).run(id, filename, state, pct, detail, ownerId ?? null, clipId ?? null);
}

export function listJobs(viewer: { id: number; role: string }, limit = 6): { id: string; filename: string; state: string; pct: number; detail: string }[] {
  const all = viewer.role === "admin";
  return db
    .prepare(
      `SELECT id, filename, state, pct, detail FROM jobs
        WHERE ? = 1 OR owner_id IS NULL OR owner_id = ?
        ORDER BY created_at DESC LIMIT ?`,
    )
    .all(all ? 1 : 0, viewer.id, limit) as { id: string; filename: string; state: string; pct: number; detail: string }[];
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(path.join(config.mediaDir, dir), { recursive: true });
}

/* ---------- réglages ---------- */

export const DEFAULT_SETTINGS = {
  instance_name: "",
  theme: "ember",
  public_url: "",
  default_tags: "",
  tag_palette: "",
  default_visibility: "link",
  link_expiry_days: "0",
  invite_only: "false",
  max_upload_gb: "4",
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

export function getSettings(): Record<SettingKey, string> {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const values = { ...DEFAULT_SETTINGS } as Record<SettingKey, string>;
  for (const row of rows) {
    if (row.key in values) {
      values[row.key as SettingKey] = row.value;
    }
  }
  return values;
}

export function saveSettings(patch: Partial<Record<SettingKey, string>>): void {
  const statement = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  for (const [key, value] of Object.entries(patch)) {
    if (key in DEFAULT_SETTINGS && value !== undefined) {
      statement.run(key, String(value));
    }
  }
}

/* ---------- membres ---------- */

export interface Member extends User {
  clips: number;
  last_clip: string | null;
}

export function listMembers(): Member[] {
  return db
    .prepare(
      `SELECT u.*, COUNT(c.id) AS clips, MAX(c.created_at) AS last_clip
         FROM users u LEFT JOIN clips c ON c.uploader_id = u.id AND c.deleted_at IS NULL
        GROUP BY u.id ORDER BY u.role DESC, u.username`,
    )
    .all() as Member[];
}

export function setMemberRole(id: number, role: string): void {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
}

/* ---------- invitations ---------- */

export interface Invite {
  id: number;
  token: string;
  note: string;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  used_by_name: string | null;
  created_by_name: string | null;
}

export function listInvites(): Invite[] {
  return db
    .prepare(
      `SELECT i.id, i.token, i.note, i.created_at, i.expires_at, i.used_at,
              ub.username AS used_by_name, cb.username AS created_by_name
         FROM invites i
         LEFT JOIN users ub ON ub.id = i.used_by
         LEFT JOIN users cb ON cb.id = i.created_by
        ORDER BY i.created_at DESC LIMIT 50`,
    )
    .all() as Invite[];
}

export function createInvite(token: string, note: string, createdBy: number, expiresAt: string | null): number {
  const info = db
    .prepare("INSERT INTO invites (token, note, created_by, expires_at) VALUES (?, ?, ?, ?)")
    .run(token, note, createdBy, expiresAt);
  return Number(info.lastInsertRowid);
}

export function findInvite(token: string): Invite | undefined {
  return db.prepare("SELECT * FROM invites WHERE token = ?").get(token) as Invite | undefined;
}

export function usableInvite(token: string): Invite | undefined {
  const invite = findInvite(token);
  if (!invite || invite.used_at) {
    return undefined;
  }
  if (invite.expires_at && new Date(`${invite.expires_at.replace(" ", "T")}Z`).getTime() < Date.now()) {
    return undefined;
  }
  return invite;
}

export function redeemInvite(token: string, userId: number): void {
  db.prepare("UPDATE invites SET used_by = ?, used_at = datetime('now') WHERE token = ? AND used_at IS NULL").run(userId, token);
}

export function revokeInvite(id: number): void {
  db.prepare("DELETE FROM invites WHERE id = ? AND used_at IS NULL").run(id);
}

export interface ClipUpdate {
  title: string;
  description: string;
  game: string;
  visibility: string;
  share_expires: string | null;
}

export function updateClip(id: number, patch: ClipUpdate): void {
  db.prepare(
    `UPDATE clips SET title = ?, description = ?, game_id = ?, visibility = ?, share_expires = ?,
                      updated_at = datetime('now') WHERE id = ?`,
  ).run(
    patch.title,
    patch.description,
    patch.game ? upsertGame(patch.game.trim().toLowerCase().replace(/\s+/g, "-"), patch.game.trim()) : null,
    patch.visibility,
    patch.share_expires,
    id,
  );
}

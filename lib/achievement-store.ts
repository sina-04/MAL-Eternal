import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { cycleBounds, seasonBounds } from "./chronicle";
import { achievementIdentity } from "./achievement-backup";
import type {
  Achievement,
  AchievementFilters,
  AchievementImportMode,
  AchievementImportResult,
  AchievementInput,
} from "../types/achievement";

type AchievementRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  achieved_on: string;
  started_on: string | null;
  finished_on: string | null;
  category: Achievement["category"];
  custom_category: string | null;
  tags_json: string;
  importance: Achievement["importance"];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

let schemaReady: Promise<void> | null = null;

export async function getRequestUserId(): Promise<string | null> {
  const user = await getChatGPTUser();
  if (user) return user.userId;
  return process.env.NODE_ENV === "development" ? "local-preview-user" : null;
}

export async function listAchievements(
  userId: string,
  filters: AchievementFilters = {},
): Promise<Achievement[]> {
  await ensureAchievementSchema();
  const where = ["user_id = ?"];
  const values: unknown[] = [userId];

  if (filters.cycle) {
    const bounds = filters.season
      ? seasonBounds(filters.cycle, filters.season)
      : cycleBounds(filters.cycle);
    where.push("achieved_on BETWEEN ? AND ?");
    values.push(bounds.from, bounds.to);
  }
  if (filters.month) {
    const cycle = filters.cycle ?? new Date().getFullYear();
    const year = filters.month <= 3 ? cycle + 1 : cycle;
    where.push("achieved_on LIKE ?");
    values.push(`${year}-${String(filters.month).padStart(2, "0")}%`);
  }
  if (filters.query) {
    where.push(
      "(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ? OR LOWER(COALESCE(custom_category, '')) LIKE ? OR LOWER(tags_json) LIKE ? OR LOWER(COALESCE(notes, '')) LIKE ?)",
    );
    const needle = `%${filters.query.toLowerCase()}%`;
    values.push(needle, needle, needle, needle, needle, needle);
  }
  if (filters.category) {
    where.push("(category = ? OR LOWER(COALESCE(custom_category, '')) = ?)");
    values.push(filters.category, filters.category.toLowerCase());
  }
  if (filters.importance) {
    where.push("importance = ?");
    values.push(filters.importance);
  }
  if (filters.tag) {
    where.push("LOWER(tags_json) LIKE ?");
    values.push(`%"${filters.tag.toLowerCase()}"%`);
  }
  if (filters.milestonesOnly) {
    where.push("importance = 'milestone'");
  }

  const statement = env.DB.prepare(
    `SELECT * FROM achievements WHERE ${where.join(" AND ")} ORDER BY achieved_on DESC, created_at DESC LIMIT 5000`,
  ).bind(...values);
  const result = await statement.all<AchievementRow>();
  return (result.results ?? []).map(rowToAchievement);
}

export async function getAchievement(userId: string, id: string): Promise<Achievement | null> {
  await ensureAchievementSchema();
  const row = await env.DB.prepare(
    "SELECT * FROM achievements WHERE id = ? AND user_id = ? LIMIT 1",
  ).bind(id, userId).first<AchievementRow>();
  return row ? rowToAchievement(row) : null;
}

export async function createAchievement(
  userId: string,
  input: AchievementInput,
): Promise<Achievement> {
  await ensureAchievementSchema();
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO achievements (
      id, user_id, title, description, achieved_on, started_on, finished_on,
      category, custom_category, tags_json, importance, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    userId,
    input.title,
    input.description,
    input.achievedOn,
    input.startedOn ?? null,
    input.finishedOn ?? null,
    input.category,
    input.customCategory ?? null,
    JSON.stringify(input.tags ?? []),
    input.importance,
    input.notes ?? null,
    timestamp,
    timestamp,
  ).run();
  return (await getAchievement(userId, id))!;
}

export async function updateAchievement(
  userId: string,
  id: string,
  input: AchievementInput,
): Promise<Achievement | null> {
  await ensureAchievementSchema();
  const existing = await getAchievement(userId, id);
  if (!existing) return null;
  await env.DB.prepare(
    `UPDATE achievements SET
      title = ?, description = ?, achieved_on = ?, started_on = ?, finished_on = ?,
      category = ?, custom_category = ?, tags_json = ?, importance = ?, notes = ?, updated_at = ?
    WHERE id = ? AND user_id = ?`,
  ).bind(
    input.title,
    input.description,
    input.achievedOn,
    input.startedOn ?? null,
    input.finishedOn ?? null,
    input.category,
    input.customCategory ?? null,
    JSON.stringify(input.tags ?? []),
    input.importance,
    input.notes ?? null,
    new Date().toISOString(),
    id,
    userId,
  ).run();
  return getAchievement(userId, id);
}

export async function deleteAchievement(userId: string, id: string): Promise<boolean> {
  await ensureAchievementSchema();
  const result = await env.DB.prepare(
    "DELETE FROM achievements WHERE id = ? AND user_id = ?",
  ).bind(id, userId).run();
  return Number(result.meta.changes ?? 0) > 0;
}

export async function importAchievements(
  userId: string,
  inputs: readonly AchievementInput[],
  mode: AchievementImportMode,
): Promise<AchievementImportResult> {
  await ensureAchievementSchema();
  const existing = mode === "merge" ? await listAchievements(userId) : [];
  const seen = new Set(existing.map(achievementIdentity));
  const accepted: AchievementInput[] = [];
  let skipped = 0;

  for (const input of inputs) {
    const identity = achievementIdentity(input);
    if (seen.has(identity)) {
      skipped += 1;
      continue;
    }
    seen.add(identity);
    accepted.push(input);
  }

  const statements = mode === "replace"
    ? [env.DB.prepare("DELETE FROM achievements WHERE user_id = ?").bind(userId)]
    : [];
  for (const input of accepted) {
    const timestamp = new Date().toISOString();
    statements.push(env.DB.prepare(
      `INSERT INTO achievements (
        id, user_id, title, description, achieved_on, started_on, finished_on,
        category, custom_category, tags_json, importance, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), userId, input.title, input.description, input.achievedOn,
      input.startedOn ?? null, input.finishedOn ?? null, input.category,
      input.customCategory ?? null, JSON.stringify(input.tags ?? []), input.importance,
      input.notes ?? null, timestamp, timestamp,
    ));
  }
  if (statements.length) await env.DB.batch(statements);
  return { imported: accepted.length, skipped };
}

async function ensureAchievementSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await env.DB.batch([
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS achievements (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          achieved_on TEXT NOT NULL,
          started_on TEXT,
          finished_on TEXT,
          category TEXT NOT NULL,
          custom_category TEXT,
          tags_json TEXT NOT NULL DEFAULT '[]',
          importance TEXT NOT NULL DEFAULT 'normal',
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`),
        env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_achievements_user_date ON achievements(user_id, achieved_on)"),
        env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_achievements_user_category ON achievements(user_id, category)"),
      ]);
    })();
  }
  return schemaReady;
}

function rowToAchievement(row: AchievementRow): Achievement {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags_json) as unknown;
    if (Array.isArray(parsed)) tags = parsed.filter((tag): tag is string => typeof tag === "string");
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    achievedOn: row.achieved_on,
    startedOn: row.started_on,
    finishedOn: row.finished_on,
    category: row.category,
    customCategory: row.custom_category,
    tags,
    importance: row.importance,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

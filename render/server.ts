import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import {
  createServer,
  request as proxyRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { cycleBounds, getActiveCycleStart, seasonBounds, summarizeAchievements } from "../lib/chronicle";
import { validateAchievementInput } from "../lib/achievement-validation";
import { translate, type Locale } from "../lib/i18n";
import type {
  Achievement,
  AchievementFilters,
  AchievementImportance,
  AchievementInput,
  SeasonKey,
} from "../types/achievement";

if (process.env.MAL_RENDER_PREVIEW !== "1") {
  throw new Error("The Render preview server requires MAL_RENDER_PREVIEW=1.");
}

const publicPort = numericPort(process.env.PORT, 10_000);
const internalPort = numericPort(process.env.MAL_INTERNAL_PORT, publicPort === 3_100 ? 3_101 : 3_100);
const databasePath = process.env.MAL_PREVIEW_DB_PATH || resolve(process.cwd(), ".render-preview", "achievements.sqlite");
const secureCookies = process.env.MAL_COOKIE_SECURE === "1";
const cookieName = "mal_preview_id";
const visitorPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

mkdirSync(dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS achievements (
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
  );
  CREATE INDEX IF NOT EXISTS idx_achievements_user_date ON achievements(user_id, achieved_on);
  CREATE INDEX IF NOT EXISTS idx_achievements_user_category ON achievements(user_id, category);
`);

let backendReady = false;
const vinextCli = resolve(process.cwd(), "node_modules", "vinext", "dist", "cli.js");
const backend = spawn(
  process.execPath,
  [vinextCli, "start", "--port", String(internalPort), "--hostname", "127.0.0.1"],
  { env: { ...process.env, PORT: String(internalPort) }, stdio: "inherit" },
);

backend.on("exit", (code, signal) => {
  if (signal || code !== 0) {
    console.error(`Vinext exited before the preview server (${signal ?? code ?? "unknown"}).`);
    process.exitCode = 1;
  }
});

void waitForBackend();

const server = createServer(async (request, response) => {
  const visitor = visitorFor(request);
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname === "/healthz") {
      const healthy = backendReady && database.prepare("SELECT 1 AS ok").get() !== undefined;
      return json(response, healthy ? 200 : 503, { status: healthy ? "ready" : "starting" }, visitor.cookie);
    }
    if (url.pathname === "/api/achievements") {
      return await achievementsRoute(request, response, url, visitor);
    }
    const achievementMatch = url.pathname.match(/^\/api\/achievements\/([^/]+)$/);
    if (achievementMatch) {
      return await achievementRoute(request, response, decodeURIComponent(achievementMatch[1]), visitor);
    }
    if (url.pathname === "/api/analytics") {
      return analyticsRoute(request, response, url, visitor);
    }
    return proxyToVinext(request, response, visitor.cookie);
  } catch (error) {
    console.error("Render preview request failed", error);
    return json(response, 500, { error: "The preview is temporarily unavailable." }, visitor.cookie);
  }
});

server.listen(publicPort, "0.0.0.0", () => {
  console.log(`MAL Eternal Render preview listening on 0.0.0.0:${publicPort}`);
});

async function achievementsRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  visitor: Visitor,
) {
  const locale = requestLocale(request);
  if (request.method === "GET") {
    const cycleValue = Number(url.searchParams.get("cycle"));
    const monthValue = Number(url.searchParams.get("month"));
    const filters: AchievementFilters = {
      cycle: Number.isInteger(cycleValue) ? cycleValue : undefined,
      season: (url.searchParams.get("season") || undefined) as SeasonKey | undefined,
      month: monthValue >= 1 && monthValue <= 12 ? monthValue : undefined,
      query: url.searchParams.get("q")?.trim() || undefined,
      category: url.searchParams.get("category")?.trim() || undefined,
      importance: (url.searchParams.get("importance") || undefined) as AchievementImportance | undefined,
      tag: url.searchParams.get("tag")?.trim() || undefined,
      milestonesOnly: url.searchParams.get("milestones") === "true",
    };
    return json(response, 200, { achievements: listAchievements(visitor.id, filters) }, visitor.cookie);
  }
  if (request.method === "POST") {
    const validation = validateAchievementInput(await readJson(request), locale);
    if (!validation.ok) {
      return json(response, 400, { error: validation.error, fieldErrors: validation.fieldErrors }, visitor.cookie);
    }
    return json(response, 201, { achievement: createAchievement(visitor.id, validation.value) }, visitor.cookie);
  }
  return methodNotAllowed(response, visitor.cookie, "GET, POST");
}

async function achievementRoute(
  request: IncomingMessage,
  response: ServerResponse,
  id: string,
  visitor: Visitor,
) {
  const locale = requestLocale(request);
  if (request.method === "PATCH") {
    const validation = validateAchievementInput(await readJson(request), locale);
    if (!validation.ok) {
      return json(response, 400, { error: validation.error, fieldErrors: validation.fieldErrors }, visitor.cookie);
    }
    const achievement = updateAchievement(visitor.id, id, validation.value);
    return achievement
      ? json(response, 200, { achievement }, visitor.cookie)
      : json(response, 404, { error: translate(locale, "notFound") }, visitor.cookie);
  }
  if (request.method === "DELETE") {
    const deleted = deleteAchievement(visitor.id, id);
    return deleted
      ? json(response, 200, { deleted: true }, visitor.cookie)
      : json(response, 404, { error: translate(locale, "notFound") }, visitor.cookie);
  }
  return methodNotAllowed(response, visitor.cookie, "PATCH, DELETE");
}

function analyticsRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  visitor: Visitor,
) {
  if (request.method !== "GET") return methodNotAllowed(response, visitor.cookie, "GET");
  const cycleValue = Number(url.searchParams.get("cycle"));
  const cycle = Number.isInteger(cycleValue) ? cycleValue : getActiveCycleStart();
  return json(response, 200, { summary: summarizeAchievements(listAchievements(visitor.id), cycle) }, visitor.cookie);
}

function listAchievements(userId: string, filters: AchievementFilters = {}): Achievement[] {
  const where = ["user_id = ?"];
  const values: Array<string | number> = [userId];

  if (filters.cycle) {
    const bounds = filters.season ? seasonBounds(filters.cycle, filters.season) : cycleBounds(filters.cycle);
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
    where.push("(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ? OR LOWER(COALESCE(custom_category, '')) LIKE ? OR LOWER(tags_json) LIKE ? OR LOWER(COALESCE(notes, '')) LIKE ?)");
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
  if (filters.milestonesOnly) where.push("importance = 'milestone'");

  const rows = database.prepare(
    `SELECT * FROM achievements WHERE ${where.join(" AND ")} ORDER BY achieved_on DESC, created_at DESC LIMIT 5000`,
  ).all(...values) as AchievementRow[];
  return rows.map(rowToAchievement);
}

function getAchievement(userId: string, id: string): Achievement | null {
  const row = database.prepare(
    "SELECT * FROM achievements WHERE id = ? AND user_id = ? LIMIT 1",
  ).get(id, userId) as AchievementRow | undefined;
  return row ? rowToAchievement(row) : null;
}

function createAchievement(userId: string, input: AchievementInput): Achievement {
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  database.prepare(`INSERT INTO achievements (
    id, user_id, title, description, achieved_on, started_on, finished_on,
    category, custom_category, tags_json, importance, notes, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      id, userId, input.title, input.description, input.achievedOn,
      input.startedOn ?? null, input.finishedOn ?? null, input.category,
      input.customCategory ?? null, JSON.stringify(input.tags ?? []), input.importance,
      input.notes ?? null, timestamp, timestamp,
    );
  return getAchievement(userId, id)!;
}

function updateAchievement(userId: string, id: string, input: AchievementInput): Achievement | null {
  if (!getAchievement(userId, id)) return null;
  database.prepare(`UPDATE achievements SET
    title = ?, description = ?, achieved_on = ?, started_on = ?, finished_on = ?,
    category = ?, custom_category = ?, tags_json = ?, importance = ?, notes = ?, updated_at = ?
    WHERE id = ? AND user_id = ?`)
    .run(
      input.title, input.description, input.achievedOn, input.startedOn ?? null,
      input.finishedOn ?? null, input.category, input.customCategory ?? null,
      JSON.stringify(input.tags ?? []), input.importance, input.notes ?? null,
      new Date().toISOString(), id, userId,
    );
  return getAchievement(userId, id);
}

function deleteAchievement(userId: string, id: string): boolean {
  const result = database.prepare("DELETE FROM achievements WHERE id = ? AND user_id = ?").run(id, userId);
  return Number(result.changes) > 0;
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

function visitorFor(request: IncomingMessage): Visitor {
  const cookies = Object.fromEntries(
    (request.headers.cookie || "").split(";").map((part) => {
      const separator = part.indexOf("=");
      return separator < 0 ? [part.trim(), ""] : [part.slice(0, separator).trim(), part.slice(separator + 1)];
    }),
  );
  const existing = cookies[cookieName];
  if (existing && visitorPattern.test(existing)) return { id: existing };
  const id = randomUUID();
  const secure = secureCookies ? "; Secure" : "";
  return { id, cookie: `${cookieName}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}` };
}

function requestLocale(request: IncomingMessage): Locale {
  return request.headers["x-mal-locale"] === "fa" ? "fa" : "en";
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Request body exceeds the preview limit.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null") as unknown;
}

function proxyToVinext(request: IncomingMessage, response: ServerResponse, cookie?: string) {
  if (!backendReady) return json(response, 503, { status: "starting" }, cookie);
  const headers: IncomingHttpHeaders = { ...request.headers, host: `127.0.0.1:${internalPort}` };
  const proxied = proxyRequest(
    { hostname: "127.0.0.1", port: internalPort, path: request.url, method: request.method, headers },
    (backendResponse) => {
      const responseHeaders: IncomingHttpHeaders = { ...backendResponse.headers };
      if (cookie) {
        const existing = responseHeaders["set-cookie"];
        responseHeaders["set-cookie"] = [...(Array.isArray(existing) ? existing : existing ? [existing] : []), cookie];
      }
      response.writeHead(backendResponse.statusCode || 502, responseHeaders);
      backendResponse.pipe(response);
    },
  );
  proxied.on("error", (error) => {
    console.error("Vinext proxy failed", error);
    if (!response.headersSent) json(response, 502, { error: "The preview renderer is unavailable." }, cookie);
    else response.destroy(error);
  });
  request.pipe(proxied);
}

function json(response: ServerResponse, status: number, body: unknown, cookie?: string) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  if (cookie) response.setHeader("Set-Cookie", cookie);
  response.end(JSON.stringify(body));
}

function methodNotAllowed(response: ServerResponse, cookie: string | undefined, allow: string) {
  response.setHeader("Allow", allow);
  return json(response, 405, { error: "Method not allowed." }, cookie);
}

async function waitForBackend() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${internalPort}/`, { method: "HEAD" });
      if (response.status < 500) {
        backendReady = true;
        console.log("Vinext renderer is ready.");
        return;
      }
    } catch {
      // The renderer is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  console.error("Vinext renderer did not become ready within 30 seconds.");
}

function numericPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : fallback;
}

function shutdown(signal: NodeJS.Signals) {
  backend.kill(signal);
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

type Visitor = { id: string; cookie?: string };

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

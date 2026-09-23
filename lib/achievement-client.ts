import { achievementIdentity, type AchievementBackup } from "./achievement-backup";
import { validateAchievementInput } from "./achievement-validation";
import { summarizeAchievements } from "./chronicle";
import type { Locale } from "./i18n";
import type {
  Achievement,
  AchievementImportMode,
  AchievementImportResult,
  AchievementInput,
  AnalyticsSummary,
} from "../types/achievement";

const LOCAL_STORAGE_KEY = "mal-eternal:achievements:v1";
const USE_BROWSER_STORAGE = process.env.NEXT_PUBLIC_ACHIEVEMENT_STORAGE === "local";

export class AchievementClientError extends Error {
  fieldErrors?: Partial<Record<keyof AchievementInput, string>>;

  constructor(message: string, fieldErrors?: Partial<Record<keyof AchievementInput, string>>) {
    super(message);
    this.name = "AchievementClientError";
    this.fieldErrors = fieldErrors;
  }
}

export async function loadAchievementData(
  locale: Locale,
  cycle: number,
): Promise<{ achievements: Achievement[]; summary: AnalyticsSummary }> {
  if (USE_BROWSER_STORAGE) {
    const achievements = readLocalAchievements(locale);
    return { achievements, summary: summarizeAchievements(achievements, cycle) };
  }

  const [recordsResponse, analyticsResponse] = await Promise.all([
    fetch("/api/achievements", { cache: "no-store", headers: { "x-mal-locale": locale } }),
    fetch(`/api/analytics?cycle=${cycle}`, { cache: "no-store", headers: { "x-mal-locale": locale } }),
  ]);
  const records = await recordsResponse.json() as { achievements?: Achievement[]; error?: string };
  const analytics = await analyticsResponse.json() as { summary?: AnalyticsSummary; error?: string };
  if (!recordsResponse.ok || !records.achievements) {
    throw new AchievementClientError(records.error || "Unable to open the achievement archive.");
  }
  return {
    achievements: records.achievements,
    summary: analytics.summary ?? summarizeAchievements(records.achievements, cycle),
  };
}

export async function saveAchievement(
  input: AchievementInput,
  locale: Locale,
  existing?: Achievement | null,
): Promise<Achievement> {
  if (!USE_BROWSER_STORAGE) {
    const response = await fetch(
      existing ? `/api/achievements/${existing.id}` : "/api/achievements",
      {
        method: existing ? "PATCH" : "POST",
        headers: { "content-type": "application/json", "x-mal-locale": locale },
        body: JSON.stringify(input),
      },
    );
    const result = await response.json() as {
      achievement?: Achievement;
      error?: string;
      fieldErrors?: Partial<Record<keyof AchievementInput, string>>;
    };
    if (!response.ok || !result.achievement) {
      throw new AchievementClientError(result.error || "Unable to save the achievement.", result.fieldErrors);
    }
    return result.achievement;
  }

  const validation = validateAchievementInput(input, locale);
  if (!validation.ok) {
    throw new AchievementClientError(validation.error, validation.fieldErrors);
  }
  const records = readLocalAchievements(locale);
  const now = new Date().toISOString();
  const achievement: Achievement = {
    ...toAchievementFields(validation.value),
    id: existing?.id ?? createId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const next = existing
    ? records.map((record) => record.id === existing.id ? achievement : record)
    : [achievement, ...records];
  writeLocalAchievements(next);
  return achievement;
}

export async function removeAchievement(id: string, locale: Locale): Promise<void> {
  if (!USE_BROWSER_STORAGE) {
    const response = await fetch(`/api/achievements/${id}`, {
      method: "DELETE",
      headers: { "x-mal-locale": locale },
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new AchievementClientError(result.error || "Unable to erase the achievement.");
    return;
  }

  writeLocalAchievements(readLocalAchievements(locale).filter((record) => record.id !== id));
}

export async function importAchievementBackup(
  backup: AchievementBackup,
  mode: AchievementImportMode,
  locale: Locale,
): Promise<AchievementImportResult> {
  if (!USE_BROWSER_STORAGE) {
    const response = await fetch("/api/achievements/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mal-locale": locale },
      body: JSON.stringify({ mode, backup }),
    });
    const result = await response.json() as AchievementImportResult & { error?: string };
    if (!response.ok) throw new AchievementClientError(result.error || "Unable to import the backup.");
    return { imported: result.imported, skipped: result.skipped };
  }

  const current = readLocalAchievements(locale);
  const existing = mode === "replace" ? [] : current;
  const seen = new Set(existing.map(achievementIdentity));
  const now = new Date().toISOString();
  const imported: Achievement[] = [];
  let skipped = 0;

  for (const input of backup.achievements) {
    const identity = achievementIdentity(input);
    if (seen.has(identity)) {
      skipped += 1;
      continue;
    }
    seen.add(identity);
    imported.push({
      ...toAchievementFields(input),
      id: createId(),
      createdAt: now,
      updatedAt: now,
    });
  }

  writeLocalAchievements([...imported, ...existing]);
  return { imported: imported.length, skipped };
}

function readLocalAchievements(locale: Locale): Achievement[] {
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((record): Achievement[] => {
      if (!record || typeof record !== "object" || Array.isArray(record)) return [];
      const source = record as Partial<Achievement>;
      const validation = validateAchievementInput(source, locale);
      if (!validation.ok || typeof source.id !== "string") return [];
      return [{
        ...toAchievementFields(validation.value),
        id: source.id,
        createdAt: typeof source.createdAt === "string" ? source.createdAt : new Date().toISOString(),
        updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
      }];
    }).sort((left, right) =>
      right.achievedOn.localeCompare(left.achievedOn) || right.createdAt.localeCompare(left.createdAt));
  } catch {
    return [];
  }
}

function writeLocalAchievements(achievements: Achievement[]) {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(achievements));
}

function toAchievementFields(input: AchievementInput): Pick<
  Achievement,
  | "title"
  | "description"
  | "achievedOn"
  | "startedOn"
  | "finishedOn"
  | "category"
  | "customCategory"
  | "tags"
  | "importance"
  | "notes"
> {
  return {
    title: input.title,
    description: input.description,
    achievedOn: input.achievedOn,
    startedOn: input.startedOn ?? null,
    finishedOn: input.finishedOn ?? null,
    category: input.category,
    customCategory: input.customCategory ?? null,
    tags: [...(input.tags ?? [])],
    importance: input.importance,
    notes: input.notes ?? null,
  };
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

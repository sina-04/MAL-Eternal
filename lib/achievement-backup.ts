import type { Achievement, AchievementInput } from "../types/achievement.ts";
import { validateAchievementInput } from "./achievement-validation.ts";
import { translate, type Locale } from "./i18n.ts";

export const ACHIEVEMENT_BACKUP_FORMAT = "mal-eternal-achievements";
export const ACHIEVEMENT_BACKUP_VERSION = 1;
export const MAX_BACKUP_RECORDS = 1_000;

export type AchievementBackup = {
  format: typeof ACHIEVEMENT_BACKUP_FORMAT;
  version: typeof ACHIEVEMENT_BACKUP_VERSION;
  exportedAt: string;
  achievements: AchievementInput[];
};

export type BackupValidationIssue = {
  record: number | null;
  message: string;
};

export type BackupParseResult =
  | { ok: true; backup: AchievementBackup }
  | { ok: false; error: string; issues: BackupValidationIssue[] };

export function createAchievementBackup(achievements: readonly Achievement[]): AchievementBackup {
  return {
    format: ACHIEVEMENT_BACKUP_FORMAT,
    version: ACHIEVEMENT_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    achievements: achievements.map(toPortableInput),
  };
}

export function parseAchievementBackup(input: unknown, locale: Locale = "en"): BackupParseResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return invalid(translate(locale, "backupObjectRequired"));
  }

  const source = input as Record<string, unknown>;
  if (source.format !== ACHIEVEMENT_BACKUP_FORMAT) {
    return invalid(translate(locale, "backupFormatInvalid"));
  }
  if (source.version !== ACHIEVEMENT_BACKUP_VERSION) {
    return invalid(translate(locale, "backupVersionInvalid"));
  }
  if (!Array.isArray(source.achievements)) {
    return invalid(translate(locale, "backupRecordsRequired"));
  }
  if (source.achievements.length > MAX_BACKUP_RECORDS) {
    return invalid(translate(locale, "backupTooManyRecords", { count: MAX_BACKUP_RECORDS }));
  }

  const achievements: AchievementInput[] = [];
  const issues: BackupValidationIssue[] = [];
  source.achievements.forEach((record, index) => {
    const validation = validateAchievementInput(record, locale);
    if (validation.ok) achievements.push(validation.value);
    else issues.push({ record: index + 1, message: validation.error });
  });

  if (issues.length) {
    return {
      ok: false,
      error: translate(locale, "backupRecordsInvalid", { count: issues.length }),
      issues,
    };
  }

  return {
    ok: true,
    backup: {
      format: ACHIEVEMENT_BACKUP_FORMAT,
      version: ACHIEVEMENT_BACKUP_VERSION,
      exportedAt: typeof source.exportedAt === "string" ? source.exportedAt : new Date().toISOString(),
      achievements,
    },
  };
}

export function achievementIdentity(achievement: AchievementInput | Achievement): string {
  return JSON.stringify(toPortableInput(achievement));
}

function toPortableInput(achievement: AchievementInput | Achievement): AchievementInput {
  return {
    title: achievement.title,
    description: achievement.description,
    achievedOn: achievement.achievedOn,
    startedOn: achievement.startedOn ?? null,
    finishedOn: achievement.finishedOn ?? null,
    category: achievement.category,
    customCategory: achievement.customCategory ?? null,
    tags: [...(achievement.tags ?? [])],
    importance: achievement.importance,
    notes: achievement.notes ?? null,
  };
}

function invalid(error: string): BackupParseResult {
  return { ok: false, error, issues: [{ record: null, message: error }] };
}

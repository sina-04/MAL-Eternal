import {
  CURATED_CATEGORIES,
  IMPORTANCE_LEVELS,
  type AchievementInput,
} from "../types/achievement.ts";
import { todayInTehran } from "./chronicle.ts";
import { translate, type Locale } from "./i18n.ts";

type ValidationResult =
  | { ok: true; value: AchievementInput }
  | { ok: false; error: string; fieldErrors: Partial<Record<keyof AchievementInput, string>> };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateAchievementInput(input: unknown, locale: Locale = "en"): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: translate(locale, "validationRequired"), fieldErrors: {} };
  }
  const source = input as Record<string, unknown>;
  const title = stringValue(source.title);
  const description = stringValue(source.description);
  const achievedOn = stringValue(source.achievedOn);
  const startedOn = optionalString(source.startedOn);
  const finishedOn = optionalString(source.finishedOn);
  const category = stringValue(source.category);
  const customCategory = optionalString(source.customCategory);
  const importance = stringValue(source.importance);
  const notes = optionalString(source.notes);
  const tags = normalizeTags(source.tags);
  const fieldErrors: Partial<Record<keyof AchievementInput, string>> = {};

  if (!title) fieldErrors.title = translate(locale, "validationTitle");
  else if (title.length > 120) fieldErrors.title = translate(locale, "validationTitleLength");
  if (!description) fieldErrors.description = translate(locale, "validationDescription");
  else if (description.length > 2000) fieldErrors.description = translate(locale, "validationDescriptionLength");
  if (!validDate(achievedOn)) fieldErrors.achievedOn = translate(locale, "validationCompletion");
  else if (achievedOn < "2022-01-01") fieldErrors.achievedOn = translate(locale, "validationBegins");
  else if (achievedOn > todayInTehran()) fieldErrors.achievedOn = translate(locale, "validationFuture");
  if (startedOn && !validDate(startedOn)) fieldErrors.startedOn = translate(locale, "validationStart");
  if (finishedOn && !validDate(finishedOn)) fieldErrors.finishedOn = translate(locale, "validationFinish");
  if (startedOn && finishedOn && startedOn > finishedOn) {
    fieldErrors.finishedOn = translate(locale, "validationFinishAfterStart");
  }
  if (startedOn && achievedOn && startedOn > achievedOn) {
    fieldErrors.startedOn = translate(locale, "validationStartBeforeCompletion");
  }
  if (finishedOn && achievedOn && finishedOn > achievedOn) {
    fieldErrors.finishedOn = translate(locale, "validationFinishBeforeCompletion");
  }
  if (![...CURATED_CATEGORIES, "custom"].includes(category as never)) {
    fieldErrors.category = translate(locale, "validationCategory");
  }
  if (category === "custom" && !customCategory) {
    fieldErrors.customCategory = translate(locale, "validationCustomCategory");
  } else if (customCategory && customCategory.length > 50) {
    fieldErrors.customCategory = translate(locale, "validationCustomLength");
  }
  if (!IMPORTANCE_LEVELS.includes(importance as never)) {
    fieldErrors.importance = translate(locale, "validationImportance");
  }
  if (tags === null) fieldErrors.tags = translate(locale, "validationTags");
  if (notes && notes.length > 4000) fieldErrors.notes = translate(locale, "validationNotes");

  if (Object.keys(fieldErrors).length > 0 || tags === null) {
    return { ok: false, error: translate(locale, "validationReview"), fieldErrors };
  }

  return {
    ok: true,
    value: {
      title,
      description,
      achievedOn,
      startedOn: startedOn || null,
      finishedOn: finishedOn || null,
      category: category as AchievementInput["category"],
      customCategory: category === "custom" ? customCategory : null,
      tags,
      importance: importance as AchievementInput["importance"],
      notes: notes || null,
    },
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown): string | null {
  const valueString = stringValue(value);
  return valueString || null;
}

function normalizeTags(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const tags = [...new Set(value.map(stringValue).filter(Boolean))];
  if (tags.length > 10 || tags.some((tag) => tag.length > 30)) return null;
  return tags;
}

function validDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

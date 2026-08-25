export const CURATED_CATEGORIES = [
  "career",
  "learning",
  "project",
  "academic",
  "research",
  "health",
  "personal",
  "creative",
  "social",
  "other",
] as const;

export const IMPORTANCE_LEVELS = ["low", "normal", "high", "milestone"] as const;

export type AchievementCategory = (typeof CURATED_CATEGORIES)[number] | "custom";
export type AchievementImportance = (typeof IMPORTANCE_LEVELS)[number];

export interface Achievement {
  id: string;
  title: string;
  description: string;
  achievedOn: string;
  startedOn: string | null;
  finishedOn: string | null;
  category: AchievementCategory;
  customCategory: string | null;
  tags: string[];
  importance: AchievementImportance;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AchievementInput {
  title: string;
  description: string;
  achievedOn: string;
  startedOn?: string | null;
  finishedOn?: string | null;
  category: AchievementCategory;
  customCategory?: string | null;
  tags?: string[];
  importance: AchievementImportance;
  notes?: string | null;
}

export interface AchievementFilters {
  cycle?: number;
  season?: SeasonKey;
  month?: number;
  query?: string;
  category?: string;
  importance?: AchievementImportance;
  tag?: string;
  milestonesOnly?: boolean;
}

export type SeasonKey = "spring" | "summer" | "autumn" | "winter";

export interface AnalyticsSummary {
  lifetimeTotal: number;
  currentCycleTotal: number;
  previousCycleTotal: number;
  currentMonthTotal: number;
  activeDayStreak: number;
  dominantCategory: string;
  monthly: Array<{ month: string; label: string; count: number }>;
  seasons: Array<{ season: SeasonKey; count: number }>;
  categories: Array<{ category: string; label: string; count: number }>;
}

export interface ApiError {
  error: string;
  fieldErrors?: Partial<Record<keyof AchievementInput, string>>;
}

export type AchievementImportMode = "merge" | "replace";

export interface AchievementImportResult {
  imported: number;
  skipped: number;
}

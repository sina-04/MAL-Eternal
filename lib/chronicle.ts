import type { Achievement, AnalyticsSummary, SeasonKey } from "../types/achievement.ts";
import type { Locale } from "./i18n.ts";

export type SeasonDefinition = {
  key: SeasonKey;
  label: string;
  months: readonly number[];
  accent: string;
};

export const SEASONS: ReadonlyArray<SeasonDefinition> = [
  { key: "winter", label: "Winter", months: [1, 2, 3], accent: "#9ec7cf" },
  { key: "spring", label: "Spring", months: [4, 5, 6], accent: "#b8d95f" },
  { key: "summer", label: "Summer", months: [7, 8, 9], accent: "#ff9a32" },
  { key: "autumn", label: "Autumn", months: [10, 11, 12], accent: "#d95b2b" },
] as const;

export const SOLAR_HIJRI_SEASONS: ReadonlyArray<SeasonDefinition> = [
  { key: "spring", label: "Spring", months: [1, 2, 3], accent: "#b8d95f" },
  { key: "summer", label: "Summer", months: [4, 5, 6], accent: "#ff9a32" },
  { key: "autumn", label: "Autumn", months: [7, 8, 9], accent: "#d95b2b" },
  { key: "winter", label: "Winter", months: [10, 11, 12], accent: "#9ec7cf" },
] as const;

export type CalendarMode = "gregorian" | "solar-hijri";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const SOLAR_HIJRI_MONTH_NAMES = [
  "Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar",
  "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand",
] as const;

export function seasonsForCalendar(mode: CalendarMode): ReadonlyArray<SeasonDefinition> {
  return mode === "solar-hijri" ? SOLAR_HIJRI_SEASONS : SEASONS;
}

export function monthNamesForCalendar(mode: CalendarMode): readonly string[] {
  return mode === "solar-hijri" ? SOLAR_HIJRI_MONTH_NAMES : MONTH_NAMES;
}

export function getActiveCycleStart(date = new Date()): number {
  return date.getFullYear();
}

export function cycleForDate(date: string): number {
  return Number(date.slice(0, 4));
}

export function cycleLabel(year: number): string {
  return `${year} Chronicle`;
}

export function monthYearForCycle(cycle: number, _month: number): number {
  void _month;
  return cycle;
}

export function seasonForMonth(month: number): SeasonKey {
  if (month >= 4 && month <= 6) return "spring";
  if (month >= 7 && month <= 9) return "summer";
  if (month >= 10 && month <= 12) return "autumn";
  return "winter";
}

export function cycleBounds(cycle: number): { from: string; to: string } {
  return { from: `${cycle}-01-01`, to: `${cycle}-12-31` };
}

const SOLAR_HIJRI_FORMATTER = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const SOLAR_HIJRI_NUMERIC_FORMATTER = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

const SOLAR_YEAR_INDEX = new Map<number, Map<string, string>>();

export function solarHijriParts(date: string): { year: number; month: number; day: number } {
  const parts = SOLAR_HIJRI_NUMERIC_FORMATTER.formatToParts(new Date(`${date}T00:00:00Z`));
  const numberPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: numberPart("year"), month: numberPart("month"), day: numberPart("day") };
}

function solarYearIndex(year: number): Map<string, string> {
  const cached = SOLAR_YEAR_INDEX.get(year);
  if (cached) return cached;
  const index = new Map<string, string>();
  const cursor = new Date(Date.UTC(year + 621, 2, 15));
  const end = new Date(Date.UTC(year + 622, 2, 25));
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    const solar = solarHijriParts(iso);
    if (solar.year === year) index.set(`${solar.month}-${solar.day}`, iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  SOLAR_YEAR_INDEX.set(year, index);
  return index;
}

export function solarHijriDateToIso(year: number, month: number, day: number): string {
  const iso = solarYearIndex(year).get(`${month}-${day}`);
  if (!iso) throw new RangeError(`Invalid Solar Hijri date: ${year}-${month}-${day}`);
  return iso;
}

export function getCurrentSolarHijriYear(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    year: "numeric",
    timeZone: "Asia/Tehran",
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "year")?.value ?? 0);
}

export function daysInSolarHijriMonth(year: number, month: number): number {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return solarYearIndex(year).has("12-30") ? 30 : 29;
}

export function solarHijriYearBounds(year: number): { from: string; to: string } {
  return {
    from: solarHijriDateToIso(year, 1, 1),
    to: solarHijriDateToIso(year, 12, daysInSolarHijriMonth(year, 12)),
  };
}

export function solarHijriMonthBounds(year: number, month: number): { from: string; to: string } {
  return {
    from: solarHijriDateToIso(year, month, 1),
    to: solarHijriDateToIso(year, month, daysInSolarHijriMonth(year, month)),
  };
}

export function solarHijriSeasonBounds(year: number, season: SeasonKey): { from: string; to: string } {
  const definition = SOLAR_HIJRI_SEASONS.find((item) => item.key === season) ?? SOLAR_HIJRI_SEASONS[0];
  const firstMonth = definition.months[0];
  const lastMonth = definition.months[2];
  return {
    from: solarHijriDateToIso(year, firstMonth, 1),
    to: solarHijriDateToIso(year, lastMonth, daysInSolarHijriMonth(year, lastMonth)),
  };
}

export function calendarYearBounds(year: number, mode: CalendarMode): { from: string; to: string } {
  return mode === "solar-hijri" ? solarHijriYearBounds(year) : cycleBounds(year);
}

export function calendarMonthBounds(year: number, month: number, mode: CalendarMode): { from: string; to: string } {
  if (mode === "solar-hijri") return solarHijriMonthBounds(year, month);
  return {
    from: isoDate(year, month, 1),
    to: isoDate(year, month, daysInMonth(year, month)),
  };
}

export function calendarYearForDate(date: string, mode: CalendarMode): number {
  return mode === "solar-hijri" ? solarHijriParts(date).year : cycleForDate(date);
}

export function calendarMonthForDate(date: string, mode: CalendarMode): number {
  return mode === "solar-hijri" ? solarHijriParts(date).month : Number(date.slice(5, 7));
}

export function calendarSeasonForDate(date: string, mode: CalendarMode): SeasonKey {
  const month = calendarMonthForDate(date, mode);
  if (mode === "gregorian") return seasonForMonth(month);
  if (month <= 3) return "spring";
  if (month <= 6) return "summer";
  if (month <= 9) return "autumn";
  return "winter";
}

export function formatSolarHijriDate(date: string, locale: Locale = "en"): string {
  if (locale === "en") return SOLAR_HIJRI_FORMATTER.format(new Date(`${date}T00:00:00Z`)).replace(/\s+AP$/, "");
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatGregorianRange(from: string, to: string, locale: Locale = "en"): string {
  const first = new Date(`${from}T00:00:00Z`);
  const last = new Date(`${to}T00:00:00Z`);
  const formatterLocale = locale === "fa" ? "fa-IR-u-ca-gregory" : "en-US";
  const start = new Intl.DateTimeFormat(formatterLocale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(first);
  const end = new Intl.DateTimeFormat(formatterLocale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(last);
  return `${start} – ${end}`;
}

export function seasonCalendarLabels(
  year: number,
  season: SeasonKey,
  mode: CalendarMode,
  locale: Locale = "en",
): { primary: string; equivalentCalendar: string; equivalent: string } {
  if (mode === "solar-hijri") {
    const definition = SOLAR_HIJRI_SEASONS.find((item) => item.key === season) ?? SOLAR_HIJRI_SEASONS[0];
    const firstMonth = definition.months[0];
    const lastMonth = definition.months[2];
    const bounds = solarHijriSeasonBounds(year, season);
    return {
      primary: locale === "fa"
        ? `${formatSolarHijriDate(bounds.from, locale)} – ${formatSolarHijriDate(bounds.to, locale)}`
        : `${SOLAR_HIJRI_MONTH_NAMES[firstMonth - 1]} 1, ${year} – ${SOLAR_HIJRI_MONTH_NAMES[lastMonth - 1]} ${daysInSolarHijriMonth(year, lastMonth)}, ${year}`,
      equivalentCalendar: locale === "fa" ? "میلادی" : "Gregorian",
      equivalent: formatGregorianRange(bounds.from, bounds.to, locale),
    };
  }
  const bounds = seasonBounds(year, season);
  const gregorian = formatGregorianRange(bounds.from, bounds.to, locale);
  const solarHijri = `${formatSolarHijriDate(bounds.from, locale)} – ${formatSolarHijriDate(bounds.to, locale)}`;
  return { primary: gregorian, equivalentCalendar: locale === "fa" ? "هجری شمسی" : "Solar Hijri", equivalent: solarHijri };
}

export function solarHijriYearSpan(year: number): string {
  const extractYear = (date: string) => SOLAR_HIJRI_FORMATTER
    .formatToParts(new Date(`${date}T00:00:00Z`))
    .find((part) => part.type === "year")?.value ?? "";
  return `${extractYear(`${year}-01-01`)}–${extractYear(`${year}-12-31`)}`;
}

export function seasonBounds(cycle: number, season: SeasonKey): { from: string; to: string } {
  const definition = SEASONS.find((item) => item.key === season) ?? SEASONS[0];
  const firstMonth = definition.months[0];
  const lastMonth = definition.months[2];
  const fromYear = monthYearForCycle(cycle, firstMonth);
  const toYear = monthYearForCycle(cycle, lastMonth);
  return {
    from: `${fromYear}-${String(firstMonth).padStart(2, "0")}-01`,
    to: `${toYear}-${String(lastMonth).padStart(2, "0")}-${daysInMonth(toYear, lastMonth)}`,
  };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayInTehran(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function formatDate(date: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${date}T00:00:00Z`));
}

export function categoryLabel(category: string, customCategory?: string | null): string {
  if (category === "custom") return customCategory?.trim() || "Custom";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function summarizeAchievements(
  achievements: readonly Achievement[],
  cycle = getActiveCycleStart(),
  today = todayInTehran(),
): AnalyticsSummary {
  const currentBounds = cycleBounds(cycle);
  const previousBounds = cycleBounds(cycle - 1);
  const currentMonth = today.slice(0, 7);
  const currentCycle = achievements.filter(
    (item) => item.achievedOn >= currentBounds.from && item.achievedOn <= currentBounds.to,
  );
  const previousCycle = achievements.filter(
    (item) => item.achievedOn >= previousBounds.from && item.achievedOn <= previousBounds.to,
  );

  const categoryCounts = new Map<string, number>();
  for (const item of achievements) {
    const label = categoryLabel(item.category, item.customCategory);
    categoryCounts.set(label, (categoryCounts.get(label) ?? 0) + 1);
  }
  const categories = [...categoryCounts.entries()]
    .map(([label, count]) => ({ category: label.toLowerCase(), label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const monthly = SEASONS.flatMap((season) => season.months).map((month) => {
    const year = monthYearForCycle(cycle, month);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    return {
      month: key,
      label: MONTH_NAMES[month - 1].slice(0, 3),
      count: currentCycle.filter((item) => item.achievedOn.startsWith(key)).length,
    };
  });

  const seasons = SEASONS.map((season) => ({
    season: season.key,
    count: currentCycle.filter(
      (item) => seasonForMonth(Number(item.achievedOn.slice(5, 7))) === season.key,
    ).length,
  }));

  return {
    lifetimeTotal: achievements.length,
    currentCycleTotal: currentCycle.length,
    previousCycleTotal: previousCycle.length,
    currentMonthTotal: achievements.filter((item) => item.achievedOn.startsWith(currentMonth)).length,
    activeDayStreak: calculateStreak(achievements, today),
    dominantCategory: categories[0]?.label ?? "Awaiting data",
    monthly,
    seasons,
    categories,
  };
}

function calculateStreak(achievements: readonly Achievement[], today: string): number {
  const activeDates = new Set(achievements.map((item) => item.achievedOn));
  const cursor = new Date(`${today}T00:00:00Z`);
  if (!activeDates.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (activeDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

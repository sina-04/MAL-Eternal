import assert from "node:assert/strict";
import test from "node:test";
import {
  SOLAR_HIJRI_MONTH_NAMES,
  SOLAR_HIJRI_SEASONS,
  calendarMonthBounds,
  calendarYearBounds,
  cycleBounds,
  cycleForDate,
  cycleLabel,
  monthYearForCycle,
  seasonCalendarLabels,
  seasonBounds,
  seasonForMonth,
  solarHijriDateToIso,
  solarHijriParts,
  summarizeAchievements,
} from "../lib/chronicle.ts";
import { validateAchievementInput } from "../lib/achievement-validation.ts";
import { categoryText, formatNumber, monthLabel, seasonLabel, translate } from "../lib/i18n.ts";

test("maps the Chronicle to the true Gregorian January through December year", () => {
  assert.equal(cycleForDate("2024-01-01"), 2024);
  assert.equal(cycleForDate("2024-12-31"), 2024);
  assert.equal(cycleForDate("2025-01-01"), 2025);
  assert.deepEqual(cycleBounds(2024), { from: "2024-01-01", to: "2024-12-31" });
  assert.deepEqual(seasonBounds(2024, "winter"), { from: "2024-01-01", to: "2024-03-31" });
  assert.equal(monthYearForCycle(2024, 2), 2024);
  assert.equal(cycleLabel(2024), "2024 Chronicle");
  assert.equal(seasonForMonth(12), "autumn");
  assert.equal(seasonForMonth(1), "winter");
});

test("shows the opposite calendar equivalent for each display mode", () => {
  assert.deepEqual(seasonCalendarLabels(2026, "winter", "gregorian"), {
    primary: "Jan 1 – Mar 31, 2026",
    equivalentCalendar: "Solar Hijri",
    equivalent: "Dey 11, 1404 – Farvardin 11, 1405",
  });
  assert.deepEqual(seasonCalendarLabels(1405, "spring", "solar-hijri"), {
    primary: "Farvardin 1, 1405 – Khordad 31, 1405",
    equivalentCalendar: "Gregorian",
    equivalent: "Mar 21 – Jun 21, 2026",
  });
});

test("localizes calendar, numeric, category, and validation language in Persian", () => {
  assert.equal(translate("fa", "addAchievement"), "افزودن دستاورد");
  assert.equal(formatNumber(1405, "fa"), "۱٬۴۰۵");
  assert.equal(monthLabel("solar-hijri", 1, "fa"), "فروردین");
  assert.equal(seasonLabel("autumn", "fa"), "پاییز");
  assert.equal(categoryText("research", null, "fa"), "پژوهش");
  assert.equal(seasonCalendarLabels(1405, "spring", "solar-hijri", "fa").equivalentCalendar, "میلادی");
  const invalid = validateAchievementInput({}, "fa");
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error, "فیلدهای مشخص‌شده را بررسی کنید.");
});

test("maps a complete Solar Hijri Chronicle from Farvardin through Esfand", () => {
  assert.deepEqual(SOLAR_HIJRI_SEASONS.map((season) => season.key), ["spring", "summer", "autumn", "winter"]);
  assert.deepEqual(SOLAR_HIJRI_MONTH_NAMES.slice(0, 3), ["Farvardin", "Ordibehesht", "Khordad"]);
  assert.deepEqual(calendarYearBounds(1405, "solar-hijri"), { from: "2026-03-21", to: "2027-03-20" });
  assert.deepEqual(calendarMonthBounds(1405, 12, "solar-hijri"), { from: "2027-02-20", to: "2027-03-20" });
  assert.equal(solarHijriDateToIso(1405, 1, 1), "2026-03-21");
  assert.deepEqual(solarHijriParts("2027-03-20"), { year: 1405, month: 12, day: 29 });
  assert.deepEqual(seasonCalendarLabels(1405, "winter", "solar-hijri"), {
    primary: "Dey 1, 1405 – Esfand 29, 1405",
    equivalentCalendar: "Gregorian",
    equivalent: "Dec 22 – Mar 20, 2027",
  });
});

test("validates rich achievement records and effort date order", () => {
  const valid = validateAchievementInput({
    title: "Shipped MAL Eternal",
    description: "Completed the first private Chronicle release.",
    achievedOn: "2024-08-22",
    startedOn: "2024-08-01",
    finishedOn: "2024-08-21",
    category: "project",
    tags: ["launch", "web"],
    importance: "milestone",
  });
  assert.equal(valid.ok, true);

  const invalid = validateAchievementInput({
    title: "Impossible sequence",
    description: "Finish date precedes the start date.",
    achievedOn: "2024-08-22",
    startedOn: "2024-08-20",
    finishedOn: "2024-08-10",
    category: "project",
    importance: "normal",
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.match(invalid.fieldErrors.finishedOn ?? "", /on or after/i);
});

test("summarizes cycle, month, category, and streak analytics", () => {
  const base = {
    description: "Recorded victory",
    startedOn: null,
    finishedOn: null,
    customCategory: null,
    tags: [],
    importance: "normal",
    notes: null,
    createdAt: "2024-08-01T00:00:00.000Z",
    updatedAt: "2024-08-01T00:00:00.000Z",
  };
  const summary = summarizeAchievements([
    { ...base, id: "1", title: "One", achievedOn: "2024-08-20", category: "project" },
    { ...base, id: "2", title: "Two", achievedOn: "2024-08-21", category: "project" },
    { ...base, id: "3", title: "Three", achievedOn: "2024-08-22", category: "learning" },
    { ...base, id: "4", title: "Prior", achievedOn: "2023-09-01", category: "career" },
  ], 2024, "2024-08-22");
  assert.equal(summary.lifetimeTotal, 4);
  assert.equal(summary.currentCycleTotal, 3);
  assert.equal(summary.previousCycleTotal, 1);
  assert.equal(summary.currentMonthTotal, 3);
  assert.equal(summary.activeDayStreak, 3);
  assert.equal(summary.dominantCategory, "Project");
});

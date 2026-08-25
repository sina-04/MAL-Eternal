"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AchievementDialog,
  ConfirmDeleteDialog,
  DialogFrame,
} from "./achievement-dialogs";
import { DoomSelect } from "./doom-select";
import { useLocale } from "./locale-provider";
import {
  SEASONS,
  calendarMonthBounds,
  calendarMonthForDate,
  calendarSeasonForDate,
  calendarYearBounds,
  calendarYearForDate,
  cycleForDate,
  daysInMonth,
  daysInSolarHijriMonth,
  getActiveCycleStart,
  getCurrentSolarHijriYear,
  isoDate,
  seasonCalendarLabels,
  seasonForMonth,
  seasonsForCalendar,
  solarHijriDateToIso,
  summarizeAchievements,
  todayInTehran,
  type CalendarMode,
} from "../lib/chronicle";
import {
  categoryLabelText,
  categoryText,
  formatNumber,
  formatUiDate,
  importanceText,
  monthLabel,
  seasonLabel,
  weekdayLabels,
} from "../lib/i18n";
import {
  CURATED_CATEGORIES,
  IMPORTANCE_LEVELS,
  type Achievement,
  type AnalyticsSummary,
  type SeasonKey,
} from "../types/achievement";

type WorkspaceView = "idle" | "chronicle" | "archive" | "milestones" | "analytics";
type Rail = "left" | "right" | null;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2021 }, (_, index) => CURRENT_YEAR - index);
const CURRENT_SOLAR_YEAR = getCurrentSolarHijriYear();
const SOLAR_YEARS = Array.from({ length: CURRENT_SOLAR_YEAR - 1400 }, (_, index) => CURRENT_SOLAR_YEAR - index);
const CALENDAR_PREFERENCE_KEY = "mal-eternal:calendar-mode";
const EMPTY_SUMMARY: AnalyticsSummary = summarizeAchievements([]);
const IS_RENDER_PREVIEW = process.env.NEXT_PUBLIC_MAL_RENDER_PREVIEW === "1";

export function CommandCenter() {
  const { locale, t } = useLocale();
  const [view, setView] = useState<WorkspaceView>("idle");
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary>(EMPTY_SUMMARY);
  const [cycle, setCycle] = useState(getActiveCycleStart());
  const [solarYear, setSolarYear] = useState(CURRENT_SOLAR_YEAR);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("gregorian");
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey | null>(null);
  const [hoveredSeason, setHoveredSeason] = useState<SeasonKey | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formDate, setFormDate] = useState(todayInTehran());
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Achievement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addingFlow, setAddingFlow] = useState(false);
  const [mobileRail, setMobileRail] = useState<Rail>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [urlReady, setUrlReady] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [importanceFilter, setImportanceFilter] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const loadRecords = useCallback(async (cycleToLoad: number) => {
    setLoading(true);
    setLoadError("");
    try {
      const [recordsResponse, analyticsResponse] = await Promise.all([
        fetch("/api/achievements", { cache: "no-store", headers: { "x-mal-locale": locale } }),
        fetch(`/api/analytics?cycle=${cycleToLoad}`, { cache: "no-store", headers: { "x-mal-locale": locale } }),
      ]);
      const records = await recordsResponse.json() as { achievements?: Achievement[]; error?: string };
      const analytics = await analyticsResponse.json() as { summary?: AnalyticsSummary; error?: string };
      if (!recordsResponse.ok || !records.achievements) throw new Error(records.error || t("archiveOpenError"));
      setAchievements(records.achievements);
      setSummary(analytics.summary ?? summarizeAchievements(records.achievements, cycleToLoad));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t("archiveOpenError"));
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedView = params.get("view") as WorkspaceView | null;
      const requestedCycle = Number(params.get("cycle"));
      const requestedSolarYear = Number(params.get("solarYear"));
      const requestedCalendar = params.get("calendar");
      const requestedSeason = params.get("season") as SeasonKey | null;
      const requestedMonth = Number(params.get("month"));
      const savedCalendar = window.localStorage.getItem(CALENDAR_PREFERENCE_KEY);
      if (["chronicle", "archive", "milestones", "analytics"].includes(requestedView ?? "")) setView(requestedView!);
      if (Number.isInteger(requestedCycle) && requestedCycle >= 2022 && requestedCycle <= CURRENT_YEAR) setCycle(requestedCycle);
      if (Number.isInteger(requestedSolarYear) && requestedSolarYear >= 1401 && requestedSolarYear <= CURRENT_SOLAR_YEAR) setSolarYear(requestedSolarYear);
      if (SEASONS.some((season) => season.key === requestedSeason)) setSelectedSeason(requestedSeason);
      if (requestedMonth >= 1 && requestedMonth <= 12) setSelectedMonth(requestedMonth);
      if (requestedCalendar === "gregorian" || requestedCalendar === "solar-hijri") setCalendarMode(requestedCalendar);
      else if (savedCalendar === "gregorian" || savedCalendar === "solar-hijri") setCalendarMode(savedCalendar);
      setUrlReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRecords(cycle), 0);
    return () => window.clearTimeout(timer);
  }, [cycle, loadRecords]);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (view !== "idle") params.set("view", view);
    if (view === "chronicle" || view === "analytics") params.set("cycle", String(cycle));
    if (view === "chronicle") {
      params.set("calendar", calendarMode);
      if (calendarMode === "solar-hijri") params.set("solarYear", String(solarYear));
    }
    if (view === "chronicle" && selectedSeason) params.set("season", selectedSeason);
    if (view === "chronicle" && selectedMonth) params.set("month", String(selectedMonth));
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }, [calendarMode, cycle, selectedMonth, selectedSeason, solarYear, urlReady, view]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const customCategories = useMemo(
    () => [...new Set(achievements.map((item) => item.customCategory).filter((value): value is string => Boolean(value)))].sort(),
    [achievements],
  );
  const activeSeason = hoveredSeason ?? selectedSeason;
  const chronicleYear = calendarMode === "solar-hijri" ? solarYear : cycle;
  const chronicleAchievements = useMemo(() => {
    const bounds = calendarYearBounds(chronicleYear, calendarMode);
    return achievements.filter((item) => item.achievedOn >= bounds.from && item.achievedOn <= bounds.to);
  }, [achievements, calendarMode, chronicleYear]);
  const monthAchievements = useMemo(() => {
    if (!selectedMonth) return [];
    const bounds = calendarMonthBounds(chronicleYear, selectedMonth, calendarMode);
    return chronicleAchievements.filter((item) => item.achievedOn >= bounds.from && item.achievedOn <= bounds.to);
  }, [calendarMode, chronicleAchievements, chronicleYear, selectedMonth]);
  const archiveResults = useMemo(() => achievements.filter((item) => {
    const haystack = [item.title, item.description, item.category, item.customCategory ?? "", item.tags.join(" "), item.notes ?? ""].join(" ").toLowerCase();
    if (query && !haystack.includes(query.trim().toLowerCase())) return false;
    if (categoryFilter && item.category !== categoryFilter && item.customCategory?.toLowerCase() !== categoryFilter.toLowerCase()) return false;
    if (importanceFilter && item.importance !== importanceFilter) return false;
    if (cycleFilter && cycleForDate(item.achievedOn) !== Number(cycleFilter)) return false;
    if (seasonFilter && seasonForMonth(Number(item.achievedOn.slice(5, 7))) !== seasonFilter) return false;
    if (tagFilter && !item.tags.some((tag) => tag.toLowerCase().includes(tagFilter.toLowerCase()))) return false;
    if (view === "milestones" && item.importance !== "milestone") return false;
    return true;
  }), [achievements, categoryFilter, cycleFilter, importanceFilter, query, seasonFilter, tagFilter, view]);

  const navigate = (next: WorkspaceView) => {
    setView(next);
    setMobileRail(null);
    setAddingFlow(false);
  };
  const beginAdd = () => { setYearDialogOpen(true); setMobileRail(null); };
  const chooseCalendar = (mode: CalendarMode) => {
    setCalendarMode(mode);
    setSelectedSeason(null);
    setHoveredSeason(null);
    setSelectedMonth(null);
    window.localStorage.setItem(CALENDAR_PREFERENCE_KEY, mode);
  };
  const chooseYear = (year: number) => {
    if (calendarMode === "solar-hijri") setSolarYear(year);
    else setCycle(year);
    setSelectedSeason(null);
    setHoveredSeason(null);
    setSelectedMonth(null);
    setView("chronicle");
    setAddingFlow(true);
    setYearDialogOpen(false);
  };
  const chooseSeason = (season: SeasonKey) => { setSelectedSeason(season); setSelectedMonth(null); };
  const chooseMonth = (month: number) => { setSelectedMonth(month); setHoveredSeason(null); };
  const openNewRecord = (date: string) => { setEditing(null); setFormDate(date); setFormOpen(true); };
  const openEdit = (achievement: Achievement) => { setEditing(achievement); setFormDate(achievement.achievedOn); setFormOpen(true); };
  const onSaved = (achievement: Achievement) => {
    setAchievements((current) => {
      const next = current.some((item) => item.id === achievement.id)
        ? current.map((item) => item.id === achievement.id ? achievement : item)
        : [achievement, ...current];
      setSummary(summarizeAchievements(next, cycleForDate(achievement.achievedOn)));
      return next;
    });
    setCycle(cycleForDate(achievement.achievedOn));
    if (calendarMode === "solar-hijri") setSolarYear(calendarYearForDate(achievement.achievedOn, calendarMode));
    setSelectedSeason(calendarSeasonForDate(achievement.achievedOn, calendarMode));
    setSelectedMonth(calendarMonthForDate(achievement.achievedOn, calendarMode));
    setView("chronicle");
    setAddingFlow(false);
    setFormOpen(false);
    setToast(editing ? t("recordUpdated") : t("victoryInscribed"));
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/achievements/${deleteTarget.id}`, { method: "DELETE", headers: { "x-mal-locale": locale } });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || t("eraseError"));
      setAchievements((current) => {
        const next = current.filter((item) => item.id !== deleteTarget.id);
        setSummary(summarizeAchievements(next, cycle));
        return next;
      });
      setDeleteTarget(null);
      setToast(t("recordErased"));
    } catch (error) {
      setToast(error instanceof Error ? error.message : t("eraseError"));
    } finally {
      setDeleting(false);
    }
  };
  const focusSearch = () => {
    navigate("archive");
    window.setTimeout(() => document.querySelector<HTMLInputElement>(".archive-search input")?.focus(), 0);
  };

  return (
    <section className={`command-center ${addingFlow ? "command-center--adding" : ""}`} aria-label={t("commandCenter")}>
      {IS_RENDER_PREVIEW ? (
        <div className="render-preview-badge" role="status">
          <strong>{t("freePreview")}</strong>
          <span>{t("previewDataReset")}</span>
        </div>
      ) : null}
      <button className="rail-toggle rail-toggle--left" type="button" onClick={() => setMobileRail(mobileRail === "left" ? null : "left")} aria-expanded={mobileRail === "left"} aria-label={t("openAchievementSide")}>☰</button>
      <aside className={`command-rail command-rail--left ${mobileRail === "left" ? "command-rail--open" : ""}`} aria-label={t("achievementSide")}>
        <div className="command-rail__crest" aria-hidden="true">MAL</div>
        <p className="command-rail__eyebrow">{t("chronicleCommands")}</p>
        <nav className="command-actions" aria-label={t("achievementNavigation")}>
          <RailButton icon="+" label={t("addAchievement")} primary onClick={beginAdd} />
          <RailButton icon="◇" label={t("chronicle")} active={view === "chronicle"} onClick={() => navigate("chronicle")} />
          <RailButton icon="▤" label={t("achievementArchive")} active={view === "archive"} onClick={() => navigate("archive")} />
          <RailButton icon="◆" label={t("milestones")} active={view === "milestones"} onClick={() => navigate("milestones")} />
          <RailButton icon="⌕" label={t("search")} onClick={focusSearch} />
        </nav>
        <div className="command-rail__plaque">{t("achievementSide")}</div>
      </aside>

      <section className={`command-center__workspace ${view !== "idle" ? "command-center__workspace--active" : ""} ${addingFlow ? "command-center__workspace--adding" : ""}`}>
        {view === "idle" ? <IdleReadout onOpen={() => navigate("chronicle")} /> : null}
        {view === "chronicle" ? (
          <ChronicleView year={chronicleYear} calendarMode={calendarMode} achievements={chronicleAchievements} activeSeason={activeSeason} selectedSeason={selectedSeason} selectedMonth={selectedMonth} monthAchievements={monthAchievements} addingFlow={addingFlow} loading={loading} onCalendarModeChange={chooseCalendar} onExitAdd={() => { setAddingFlow(false); setSelectedSeason(null); setSelectedMonth(null); setView("idle"); }} onYearChange={(next) => { if (calendarMode === "solar-hijri") setSolarYear(next); else setCycle(next); setSelectedSeason(null); setSelectedMonth(null); }} onSeasonHover={setHoveredSeason} onSeasonChoose={chooseSeason} onMonthChoose={chooseMonth} onDayChoose={openNewRecord} onEdit={openEdit} onDelete={setDeleteTarget} />
        ) : null}
        {view === "archive" || view === "milestones" ? (
          <ArchiveView milestonesOnly={view === "milestones"} achievements={archiveResults} total={achievements.length} query={query} category={categoryFilter} importance={importanceFilter} cycle={cycleFilter} season={seasonFilter} tag={tagFilter} customCategories={customCategories} onQuery={setQuery} onCategory={setCategoryFilter} onImportance={setImportanceFilter} onCycle={setCycleFilter} onSeason={setSeasonFilter} onTag={setTagFilter} onClear={() => { setQuery(""); setCategoryFilter(""); setImportanceFilter(""); setCycleFilter(""); setSeasonFilter(""); setTagFilter(""); }} onAdd={beginAdd} onEdit={openEdit} onDelete={setDeleteTarget} />
        ) : null}
        {view === "analytics" ? <AnalyticsView summary={summary} cycle={cycle} loading={loading} /> : null}
        {loadError ? <div className="workspace-error" role="alert"><strong>{t("archiveLinkDisrupted")}</strong><span>{loadError}</span><button type="button" onClick={() => void loadRecords(cycle)}>{t("retry")}</button></div> : null}
      </section>

      <button className="rail-toggle rail-toggle--right" type="button" onClick={() => setMobileRail(mobileRail === "right" ? null : "right")} aria-expanded={mobileRail === "right"} aria-label={t("openAnalytics")}>▥</button>
      <aside className={`command-rail command-rail--right ${mobileRail === "right" ? "command-rail--open" : ""}`} aria-label={t("analyticalSide")}>
        <p className="command-rail__eyebrow">{t("archiveTelemetry")}</p>
        <div className="command-metrics" aria-live="polite">
          <Metric label={t("lifetimeVictories")} value={loading ? "…" : formatNumber(summary.lifetimeTotal, locale)} />
          <Metric label={t("currentChronicle")} value={loading ? "…" : formatNumber(summary.currentCycleTotal, locale)} />
          <Metric label={t("thisMonth")} value={loading ? "…" : formatNumber(summary.currentMonthTotal, locale)} />
          <Metric label={t("activeDayStreak")} value={loading ? "…" : `${formatNumber(summary.activeDayStreak, locale)} ${locale === "fa" ? t("days") : "d"}`} />
          <Metric label={t("dominantCategory")} value={loading ? "…" : categoryLabelText(summary.dominantCategory, locale)} />
        </div>
        <button className="command-analytics" type="button" onClick={() => navigate("analytics")}>{t("openAnalytics")}</button>
        <div className="command-rail__plaque">{t("analyticalSide")}</div>
      </aside>

      {mobileRail ? <button className="rail-scrim" type="button" onClick={() => setMobileRail(null)} aria-label={t("closeSidebar")} /> : null}
      {yearDialogOpen ? (
        <DialogFrame eyebrow={t("selectCoordinates")} title={t("chooseCalendarYear")} description={calendarMode === "gregorian" ? t("gregorianDescription") : t("solarDescription")} onClose={() => setYearDialogOpen(false)}>
          <CalendarSwitch value={calendarMode} onChange={chooseCalendar} />
          <div className="year-grid">{(calendarMode === "solar-hijri" ? SOLAR_YEARS : YEARS).map((year) => <button key={year} type="button" onClick={() => chooseYear(year)}><strong>{formatNumber(year, locale)}</strong><span>{calendarMode === "gregorian" ? t("gregorianChronicle") : t("solarChronicle")}</span></button>)}</div>
        </DialogFrame>
      ) : null}
      {formOpen ? <AchievementDialog achievedOn={formDate} achievement={editing} customCategories={customCategories} onClose={() => setFormOpen(false)} onSaved={onSaved} /> : null}
      {deleteTarget ? <ConfirmDeleteDialog achievement={deleteTarget} deleting={deleting} onClose={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} /> : null}
      {toast ? <div className="command-toast" role="status">{toast}</div> : null}
    </section>
  );
}

function RailButton({ icon, label, active = false, primary = false, onClick }: { icon: string; label: string; active?: boolean; primary?: boolean; onClick: () => void }) {
  return <button className={`command-action ${primary ? "command-action--primary" : ""} ${active ? "command-action--active" : ""}`} type="button" onClick={onClick} aria-current={active ? "page" : undefined}><span aria-hidden="true">{icon}</span>{label}</button>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <article className="command-metric"><span>{label}</span><strong>{value}</strong></article>;
}

function CalendarSwitch({ value, onChange }: { value: CalendarMode; onChange: (mode: CalendarMode) => void }) {
  const { t } = useLocale();
  return (
    <div className="calendar-switch" role="group" aria-label={t("calendarDisplay")}>
      <button type="button" className={value === "gregorian" ? "calendar-switch--active" : ""} aria-pressed={value === "gregorian"} onClick={() => onChange("gregorian")}>{t("gregorian")}</button>
      <button type="button" className={value === "solar-hijri" ? "calendar-switch--active" : ""} aria-pressed={value === "solar-hijri"} onClick={() => onChange("solar-hijri")}>{t("solarHijri")}</button>
    </div>
  );
}

function IdleReadout({ onOpen }: { onOpen: () => void }) {
  const { t } = useLocale();
  return (
    <div className="idle-readout">
      <p className="idle-readout__status"><span aria-hidden="true" />{t("archiveOnline")}<span aria-hidden="true" /></p>
      <blockquote className="idle-readout__quote">
        <span>{t("mainQuote1")}</span>
        <span>{t("mainQuote2")}</span>
        <span>{t("mainQuote3")}</span>
        <strong>{t("mainQuote4")}</strong>
      </blockquote>
      <button type="button" onClick={onOpen}>{t("openChronicle")}</button>
    </div>
  );
}

type ChronicleViewProps = {
  year: number; calendarMode: CalendarMode; achievements: Achievement[]; activeSeason: SeasonKey | null; selectedSeason: SeasonKey | null; selectedMonth: number | null; monthAchievements: Achievement[]; addingFlow: boolean; loading: boolean;
  onCalendarModeChange: (mode: CalendarMode) => void; onExitAdd: () => void; onYearChange: (year: number) => void; onSeasonHover: (season: SeasonKey | null) => void; onSeasonChoose: (season: SeasonKey) => void; onMonthChoose: (month: number) => void; onDayChoose: (date: string) => void; onEdit: (achievement: Achievement) => void; onDelete: (achievement: Achievement) => void;
};

function ChronicleView(props: ChronicleViewProps) {
  const { locale, t } = useLocale();
  const seasons = seasonsForCalendar(props.calendarMode);
  const availableYears = props.calendarMode === "solar-hijri" ? SOLAR_YEARS : YEARS;
  const title = props.calendarMode === "gregorian"
    ? `${formatNumber(props.year, locale)} ${t("chronicle")}`
    : `${formatNumber(props.year, locale)} ${t("solarChronicle")}`;
  return (
    <div className={`workspace-panel chronicle-view ${props.addingFlow ? "chronicle-view--adding" : ""}`}>
      <header className="workspace-header"><div><p>{props.addingFlow ? t("chooseVictoryCoordinates") : t("seasonalCampaignMap")}</p><h2>{title}</h2></div><div className="workspace-header__actions"><CalendarSwitch value={props.calendarMode} onChange={props.onCalendarModeChange} />{props.addingFlow ? <button className="button-secondary" type="button" onClick={props.onExitAdd}>{t("returnCommandCenter")}</button> : null}<DoomSelect ariaLabel={t("chronicleYear")} className="doom-select--year" value={String(props.year)} onChange={(value) => props.onYearChange(Number(value))} options={availableYears.map((year) => ({ value: String(year), label: formatNumber(year, locale), meta: props.calendarMode === "solar-hijri" ? t("solarHijri") : t("gregorian") }))} /></div></header>
      <div className={`season-grid ${props.addingFlow ? "season-grid--adding" : ""}`} role="list" aria-label={t("seasonalTimeline")}>
        {seasons.map((season) => {
          const seasonAchievements = props.achievements.filter((item) => calendarSeasonForDate(item.achievedOn, props.calendarMode) === season.key);
          const active = props.activeSeason === season.key;
          const calendarLabels = seasonCalendarLabels(props.year, season.key, props.calendarMode, locale);
          const localizedSeason = seasonLabel(season.key, locale);
          return (
            <article key={season.key} className={`season-card season-card--${season.key} ${active ? "season-card--active" : ""} ${props.selectedSeason === season.key ? "season-card--locked" : ""}`} role="listitem" onMouseEnter={() => props.onSeasonHover(season.key)} onMouseLeave={() => props.onSeasonHover(null)} onFocus={() => props.onSeasonHover(season.key)}>
              {props.addingFlow ? <div className="season-card__art" aria-hidden="true" /> : null}
              {props.addingFlow ? <div className="season-emblem" aria-hidden="true"><b>{season.key === "spring" ? "✣" : season.key === "summer" ? "☀" : season.key === "autumn" ? "⌁" : "✦"}</b><span>{locale === "fa" ? localizedSeason : localizedSeason.slice(0, 3).toUpperCase()}</span></div> : null}
              <button className="season-card__head" type="button" onClick={() => props.onSeasonChoose(season.key)} aria-expanded={active}><span className="season-card__title"><b>{localizedSeason}</b><i>{calendarLabels.primary}</i><small><strong>{calendarLabels.equivalentCalendar}</strong>{calendarLabels.equivalent}</small></span><span className="season-card__count"><strong>{formatNumber(seasonAchievements.length, locale)}</strong><small>{t("victories")}</small></span></button>
              <div className="month-tree" aria-hidden={!active}>
                {season.months.map((month) => {
                  const bounds = calendarMonthBounds(props.year, month, props.calendarMode);
                  const records = props.achievements.filter((item) => item.achievedOn >= bounds.from && item.achievedOn <= bounds.to);
                  const label = monthLabel(props.calendarMode, month, locale, props.calendarMode === "gregorian");
                  return <button className={`month-branch ${props.selectedMonth === month ? "month-branch--active" : ""}`} type="button" key={month} onClick={() => props.onMonthChoose(month)}><span><b>{label}</b><em>{formatNumber(records.length, locale)}</em></span><small>{records.slice(0, 3).map((item) => item.title).join(" · ") || t("noRecordsYet")}</small></button>;
                })}
              </div>
            </article>
          );
        })}
      </div>
      {props.selectedMonth ? <MonthPanel addingFlow={props.addingFlow} calendarMode={props.calendarMode} year={props.year} month={props.selectedMonth} achievements={props.monthAchievements} onDayChoose={props.onDayChoose} onEdit={props.onEdit} onDelete={props.onDelete} /> : <div className="chronicle-prompt"><span>{locale === "fa" ? "۰۱" : "01"}</span><p>{props.loading ? t("synchronizing") : t("revealBranches")}</p></div>}
    </div>
  );
}

function MonthPanel({ addingFlow, calendarMode, year, month, achievements, onDayChoose, onEdit, onDelete }: { addingFlow: boolean; calendarMode: CalendarMode; year: number; month: number; achievements: Achievement[]; onDayChoose: (date: string) => void; onEdit: (item: Achievement) => void; onDelete: (item: Achievement) => void }) {
  const { locale, t } = useLocale();
  const localizedMonth = monthLabel(calendarMode, month, locale);
  const count = calendarMode === "solar-hijri" ? daysInSolarHijriMonth(year, month) : daysInMonth(year, month);
  const firstDate = calendarMode === "solar-hijri" ? solarHijriDateToIso(year, month, 1) : isoDate(year, month, 1);
  const weekday = new Date(`${firstDate}T00:00:00Z`).getUTCDay();
  const offset = locale === "fa" ? (weekday + 1) % 7 : weekday;
  const today = todayInTehran();
  return (
    <section className={`month-panel ${addingFlow ? "month-panel--adding" : ""}`} aria-label={`${localizedMonth} ${formatNumber(year, locale)}`}>
      <div className="month-panel__calendar"><header><div><p>{t("selectCompletionDay")}</p><h3>{localizedMonth} {formatNumber(year, locale)}</h3></div><span>{formatNumber(achievements.length, locale)} {t("recorded")}</span></header><div className="day-grid day-grid--labels" aria-hidden="true">{weekdayLabels(locale).map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="day-grid">{Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: count }, (_, index) => { const day = index + 1; const date = calendarMode === "solar-hijri" ? solarHijriDateToIso(year, month, day) : isoDate(year, month, day); const dayCount = achievements.filter((item) => item.achievedOn === date).length; const accessibleDate = calendarMode === "solar-hijri" ? `${localizedMonth} ${formatNumber(day, locale)}، ${formatNumber(year, locale)} (${formatUiDate(date, locale)})` : formatUiDate(date, locale); return <button key={date} type="button" disabled={date > today || date < "2022-01-01"} onClick={() => onDayChoose(date)} aria-label={t("addAchievementOn", { date: accessibleDate })}>{formatNumber(day, locale)}{dayCount ? <i>{formatNumber(dayCount, locale)}</i> : null}</button>; })}</div></div>
      <div className="month-panel__records"><header><p>{t("monthBranch")}</p><h3>{t("recordedVictories")}</h3></header>{achievements.length ? achievements.map((item) => <AchievementCard key={item.id} achievement={item} onEdit={onEdit} onDelete={onDelete} compact />) : <EmptyState title={t("noVictoriesRecorded")} copy={t("chooseAvailableDay")} />}</div>
    </section>
  );
}

type ArchiveViewProps = { milestonesOnly: boolean; achievements: Achievement[]; total: number; query: string; category: string; importance: string; cycle: string; season: string; tag: string; customCategories: string[]; onQuery: (value: string) => void; onCategory: (value: string) => void; onImportance: (value: string) => void; onCycle: (value: string) => void; onSeason: (value: string) => void; onTag: (value: string) => void; onClear: () => void; onAdd: () => void; onEdit: (item: Achievement) => void; onDelete: (item: Achievement) => void };

function ArchiveView(props: ArchiveViewProps) {
  const { locale, t } = useLocale();
  return (
    <div className="workspace-panel archive-view">
      <header className="workspace-header"><div><p>{props.milestonesOnly ? t("hallMajorVictories") : t("searchableVault")}</p><h2>{props.milestonesOnly ? t("milestones") : t("achievementArchive")}</h2></div><strong>{formatNumber(props.achievements.length, locale)}<small> / {formatNumber(props.total, locale)}</small></strong></header>
      <div className="archive-toolbar">
        <label className="archive-search"><span className="sr-only">{t("searchAchievements")}</span><input type="search" placeholder={t("searchArchive")} value={props.query} onChange={(event) => props.onQuery(event.target.value)} /><b aria-hidden="true">⌕</b></label>
        <DoomSelect ariaLabel={t("filterCycle")} value={props.cycle} onChange={props.onCycle} options={[{ value: "", label: t("allCycles"), meta: t("entireArchive") }, ...YEARS.map((year) => ({ value: String(year), label: formatNumber(year, locale), meta: t("chronicle") }))]} />
        <DoomSelect ariaLabel={t("filterSeason")} value={props.season} onChange={props.onSeason} options={[{ value: "", label: t("allSeasons"), meta: t("fourFronts") }, ...SEASONS.map((season) => ({ value: season.key, label: seasonLabel(season.key, locale) }))]} />
        <DoomSelect ariaLabel={t("filterCategory")} value={props.category} onChange={props.onCategory} options={[{ value: "", label: t("allCategories"), meta: t("everyDomain") }, ...CURATED_CATEGORIES.map((category) => ({ value: category, label: categoryText(category, null, locale) })), ...props.customCategories.map((category) => ({ value: category, label: category, meta: t("custom") }))]} />
        {!props.milestonesOnly ? <DoomSelect ariaLabel={t("filterImportance")} value={props.importance} onChange={props.onImportance} options={[{ value: "", label: t("allImportance"), meta: t("everyRank") }, ...IMPORTANCE_LEVELS.map((level) => ({ value: level, label: importanceText(level, locale) }))]} /> : null}
        <input className="archive-tag-filter" aria-label={t("filterTag")} placeholder={t("tagPlaceholder")} value={props.tag} onChange={(event) => props.onTag(event.target.value)} />
        <button type="button" className="button-secondary" onClick={props.onClear}>{t("clear")}</button>
      </div>
      <div className="archive-list">{props.achievements.length ? props.achievements.map((item) => <AchievementCard key={item.id} achievement={item} onEdit={props.onEdit} onDelete={props.onDelete} />) : <EmptyState title={props.milestonesOnly ? t("noMilestones") : t("noRecordsFound")} copy={props.milestonesOnly ? t("milestoneEmpty") : t("archiveEmpty")} action={props.onAdd} />}</div>
    </div>
  );
}

function AchievementCard({ achievement, onEdit, onDelete, compact = false }: { achievement: Achievement; onEdit: (item: Achievement) => void; onDelete: (item: Achievement) => void; compact?: boolean }) {
  const { locale, t } = useLocale();
  const month = Number(achievement.achievedOn.slice(5, 7));
  return <article className={`achievement-card achievement-card--${achievement.importance} ${compact ? "achievement-card--compact" : ""}`}><div className="achievement-card__date"><strong>{formatNumber(Number(achievement.achievedOn.slice(8, 10)), locale)}</strong><span>{monthLabel("gregorian", month, locale, true)} {formatNumber(achievement.achievedOn.slice(0, 4), locale)}</span></div><div className="achievement-card__body"><div className="achievement-card__meta"><span>{categoryText(achievement.category, achievement.customCategory, locale)}</span><b>{importanceText(achievement.importance, locale)}</b></div><h3>{achievement.title}</h3>{!compact ? <p>{achievement.description}</p> : null}{achievement.tags.length ? <div className="tag-list">{achievement.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}</div><div className="achievement-card__actions"><button type="button" onClick={() => onEdit(achievement)}>{t("edit")}</button><button type="button" onClick={() => onDelete(achievement)}>{t("delete")}</button></div></article>;
}

function AnalyticsView({ summary, cycle, loading }: { summary: AnalyticsSummary; cycle: number; loading: boolean }) {
  const { locale, t } = useLocale();
  const maxMonth = Math.max(1, ...summary.monthly.map((item) => item.count));
  const maxCategory = Math.max(1, ...summary.categories.map((item) => item.count));
  const delta = summary.currentCycleTotal - summary.previousCycleTotal;
  const localizedDominant = categoryLabelText(summary.dominantCategory, locale);
  const deltaText = loading ? "…" : `${delta >= 0 ? "+" : ""}${formatNumber(delta, locale)}`;
  return <div className="workspace-panel analytics-view"><header className="workspace-header"><div><p>{t("balancedIntelligence")}</p><h2>{formatNumber(cycle, locale)} {t("chronicle")} · {t("analytics")}</h2></div><strong>{deltaText}<small> {t("vsPrior")}</small></strong></header><div className="analytics-kpis"><Metric label={t("lifetimeVictories")} value={formatNumber(summary.lifetimeTotal, locale)} /><Metric label={t("currentChronicle")} value={formatNumber(summary.currentCycleTotal, locale)} /><Metric label={t("previousChronicle")} value={formatNumber(summary.previousCycleTotal, locale)} /><Metric label={t("activeStreak")} value={`${formatNumber(summary.activeDayStreak, locale)} ${t("days")}`} /></div><div className="analytics-grid"><section><header><p>{t("monthlyActivity")}</p><h3>{t("campaignPulse")}</h3></header><div className="month-bars" aria-label={t("monthlyCounts")}>{summary.monthly.map((item) => <div key={item.month}><span style={{ height: `${Math.max(5, item.count / maxMonth * 100)}%` }}><i>{formatNumber(item.count, locale)}</i></span><b>{monthLabel("gregorian", Number(item.month.slice(5, 7)), locale, true)}</b></div>)}</div></section><section><header><p>{t("categoryDistribution")}</p><h3>{t("dominantFronts")}</h3></header><div className="category-bars">{summary.categories.length ? summary.categories.slice(0, 7).map((item) => <div key={item.label}><span><b>{categoryLabelText(item.label, locale)}</b><i>{formatNumber(item.count, locale)}</i></span><em style={{ width: `${item.count / maxCategory * 100}%` }} /></div>) : <p className="analytics-empty">{t("analyticsEmpty")}</p>}</div></section></div><p className="chart-summary">{t("summary", { achievements: formatNumber(summary.currentCycleTotal, locale), categories: formatNumber(summary.categories.length, locale) })} {summary.dominantCategory !== "Awaiting data" ? t("isDominant", { category: localizedDominant }) : t("noDominant")}</p></div>;
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: () => void }) {
  const { t } = useLocale();
  return <div className="empty-state"><span aria-hidden="true">◇</span><h3>{title}</h3><p>{copy}</p>{action ? <button className="button-primary" type="button" onClick={action}>{t("addAchievement")}</button> : null}</div>;
}

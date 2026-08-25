import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the MAL Eternal landing experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>MAL Eternal — My Achievements List<\/title>/i);
  assert.match(html, /MAL ETERNAL/);
  assert.match(html, /Enter the chronicle/);
  assert.match(html, /\/assets\/intro-landing\.svg/);
  assert.match(html, /\/assets\/mal-eternal-menu\.svg/);
  assert.match(html, /\/assets\/hell-on-earth\.mp3/);
  assert.match(html, /Achievement Side/);
  assert.match(html, /Analytical Side/);
  assert.match(html, /Add Achievement/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships the timed narration, gate transition, and required media assets", async () => {
  const [component, i18n] = await Promise.all([
    readFile(new URL("../components/landing-experience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/i18n.ts", import.meta.url), "utf8"),
    access(new URL("../public/assets/intro-landing.svg", import.meta.url)),
    access(new URL("../public/assets/mal-eternal-menu.svg", import.meta.url)),
    access(new URL("../public/assets/hell-on-earth.mp3", import.meta.url)),
  ]);

  assert.match(component, /start: 11, end: 16/);
  assert.match(component, /start: 16, end: 21/);
  assert.match(component, /start: 21, end: 26/);
  assert.match(component, /start: 27, end: 31/);
  assert.match(i18n, /Against all the evil that Hell can conjure/);
  assert.match(i18n, /Rip and tear, until it is done/);
  assert.match(i18n, /در برابر تمام شرارتی که دوزخ می‌تواند بیافریند/);
  assert.match(component, /GATE_START_TIME = 31\.15/);
  assert.match(component, /setGateOpen\(true\)/);
  assert.match(component, /setMenuVisible\(true\)/);
  assert.match(component, /\/assets\/mal-eternal-menu\.svg/);
  assert.doesNotMatch(component, />Replay</);
  assert.match(component, /sessionStorage\.getItem\("mal-eternal:intro-complete"\)/);
  assert.match(component, /sessionStorage\.setItem\("mal-eternal:intro-complete", "1"\)/);
  assert.equal(component.match(/audio\.pause\(\)/g)?.length, 1);
});

test("ships the full-screen seasonal achievement coordinate map", async () => {
  const [component, styles, i18n] = await Promise.all([
    readFile(new URL("../components/command-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/i18n.ts", import.meta.url), "utf8"),
    access(new URL("../public/assets/seasons/winter.svg", import.meta.url)),
    access(new URL("../public/assets/seasons/spring.svg", import.meta.url)),
    access(new URL("../public/assets/seasons/summer.svg", import.meta.url)),
    access(new URL("../public/assets/seasons/autumn.svg", import.meta.url)),
  ]);

  assert.match(component, /command-center--adding/);
  assert.match(component, /season-grid--adding/);
  assert.match(component, /month-panel--adding/);
  assert.match(component, /season-card__art/);
  assert.match(component, /season-emblem/);
  assert.match(component, /CalendarSwitch/);
  assert.match(i18n, /Solar Hijri/);
  assert.match(component, /SOLAR_YEARS/);
  assert.match(component, /monthLabel/);
  assert.match(component, /solarHijriDateToIso/);
  assert.match(i18n, /Return to Command Center/);
  assert.match(styles, /Full-screen achievement coordinate map/);
  assert.match(styles, /season-card--spring/);
  assert.match(styles, /season-card--summer/);
  assert.match(styles, /season-card--autumn/);
  assert.match(styles, /season-card--winter/);
  assert.match(styles, /\/assets\/seasons\/winter\.svg/);
  assert.match(styles, /month-branch:focus-visible b/);
});

test("ships a persistent English and Persian interface with RTL Sahel typography", async () => {
  const [provider, commandCenter, dialogs, i18n, styles] = await Promise.all([
    readFile(new URL("../components/locale-provider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/command-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/achievement-dialogs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/i18n.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    access(new URL("../public/fonts/Sahel.woff", import.meta.url)),
    access(new URL("../public/fonts/Sahel-Black.woff", import.meta.url)),
  ]);

  assert.match(provider, /document\.documentElement\.dir = locale === "fa" \? "rtl" : "ltr"/);
  assert.match(provider, /localStorage\.setItem\(LOCALE_STORAGE_KEY/);
  assert.match(provider, /فارسی/);
  assert.match(provider, /language-switch__persian/);
  assert.match(provider, /lang="fa" dir="rtl"/);
  assert.match(commandCenter, /useLocale/);
  assert.match(dialogs, /x-mal-locale/);
  assert.match(i18n, /افزودن دستاورد/);
  assert.match(i18n, /هجری شمسی/);
  assert.match(styles, /font-family: "Sahel"/);
  assert.match(styles, /font-family: "Sahel Black"/);
  assert.match(styles, /html\[lang="fa"\]/);
  assert.match(styles, /\.language-switch \.language-switch__persian/);
  assert.match(styles, /html\[dir="rtl"\] \.season-grid--adding \.month-tree/);
  assert.match(styles, /html\[dir="rtl"\] \.season-emblem/);
  assert.match(i18n, /Battles are relentless,/);
  assert.match(i18n, /But achievements are Eternal\./);
  assert.match(i18n, /نبردها بی‌امان‌اند،/);
  assert.match(commandCenter, /idle-readout__quote/);
  assert.match(styles, /\.idle-readout__quote strong/);
});

test("replaces native selects with accessible Doom-styled dropdown controls", async () => {
  const [dropdown, commandCenter, dialogs, styles] = await Promise.all([
    readFile(new URL("../components/doom-select.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/command-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/achievement-dialogs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(dropdown, /role="combobox"/);
  assert.match(dropdown, /role="listbox"/);
  assert.match(dropdown, /role="option"/);
  assert.match(dropdown, /aria-selected/);
  assert.match(dropdown, /ArrowDown/);
  assert.match(dropdown, /Escape/);
  assert.match(commandCenter, /DoomSelect/);
  assert.match(dialogs, /DoomSelect/);
  assert.doesNotMatch(commandCenter, /<select\b/);
  assert.doesNotMatch(dialogs, /<select\b/);
  assert.match(styles, /\.doom-select__mechanism/);
  assert.match(styles, /\.doom-select__menu/);
  assert.match(styles, /\.doom-select__option\[aria-selected="true"\]/);
});

test("ships an isolated disposable Render preview without personal seed data", async () => {
  const [server, blueprint, commandCenter, i18n] = await Promise.all([
    readFile(new URL("../render/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../render.yaml", import.meta.url), "utf8"),
    readFile(new URL("../components/command-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/i18n.ts", import.meta.url), "utf8"),
  ]);

  assert.match(blueprint, /plan: free/);
  assert.match(blueprint, /MAL_RENDER_PREVIEW/);
  assert.match(blueprint, /\/tmp\/mal-eternal-preview\.sqlite/);
  assert.match(server, /DatabaseSync/);
  assert.match(server, /mal_preview_id/);
  assert.match(server, /user_id = \?/);
  assert.match(server, /\/api\/achievements/);
  assert.doesNotMatch(server, /INSERT INTO achievements[\s\S]*VALUES\s*\([^?]/);
  assert.match(commandCenter, /NEXT_PUBLIC_MAL_RENDER_PREVIEW/);
  assert.match(i18n, /Temporary records can reset/);
});

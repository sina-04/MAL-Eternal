"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CommandCenter } from "./command-center";
import { LanguageSwitch, useLocale } from "./locale-provider";
import type { MessageKey } from "../lib/i18n";

type IntroLine = {
  readonly start: number;
  readonly end: number;
  readonly message: MessageKey;
};

const INTRO_LINES: readonly IntroLine[] = [
  { start: 11, end: 16, message: "intro1" },
  { start: 16, end: 21, message: "intro2" },
  { start: 21, end: 26, message: "intro3" },
  { start: 27, end: 31, message: "intro4" },
];

const GATE_START_TIME = 31.15;
const GATE_TRANSITION_MS = 2450;

function lineAt(time: number) {
  return INTRO_LINES.findIndex(({ start, end }) => time >= start && time < end);
}

export function LandingExperience() {
  const { t } = useLocale();
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const gateTriggeredRef = useRef(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [audioEngaged, setAudioEngaged] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeLine, setActiveLine] = useState(-1);
  const [gateOpen, setGateOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const updateTimeline = useCallback(function tick() {
    const audio = audioRef.current;
    if (!audio) return;

    setActiveLine((current) => {
      const next = lineAt(audio.currentTime);
      return current === next ? current : next;
    });

    if (audio.currentTime >= GATE_START_TIME && !gateTriggeredRef.current) {
      gateTriggeredRef.current = true;
      setGateOpen(true);
    }

    if (!audio.paused && !audio.ended) {
      animationFrameRef.current = window.requestAnimationFrame(tick);
    }
  }, []);

  const begin = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.currentTime = 0;
      gateTriggeredRef.current = false;
      setGateOpen(false);
      setMenuVisible(false);
      await audio.play();
      setAudioEngaged(true);
      setHasEntered(true);
      setIsPlaying(true);
      animationFrameRef.current = window.requestAnimationFrame(updateTimeline);
    } catch {
      setHasEntered(false);
    }
  }, [updateTimeline]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  }, []);

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
      animationFrameRef.current = window.requestAnimationFrame(updateTimeline);
      return;
    }

    audio.pause();
    setIsPlaying(false);
  }, [updateTimeline]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (window.sessionStorage.getItem("mal-eternal:intro-complete") === "1") {
        setHasEntered(true);
        setMenuVisible(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!gateOpen) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => {
        setMenuVisible(true);
        window.sessionStorage.setItem("mal-eternal:intro-complete", "1");
      },
      reducedMotion ? 120 : GATE_TRANSITION_MS,
    );

    return () => window.clearTimeout(timer);
  }, [gateOpen]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const currentLine = activeLine >= 0 ? INTRO_LINES[activeLine] : null;
  const statusMessage = menuVisible
    ? t("menuLoaded")
    : gateOpen
      ? t("entering")
      : "";

  return (
    <main
      className={`experience ${gateOpen ? "experience--gate-open" : ""} ${
        menuVisible ? "experience--menu" : ""
      }`}
    >
      <LanguageSwitch />
      <section
        className="menu-scene"
        aria-label={t("mainMenu")}
        aria-hidden={!menuVisible}
      >
        <img
          className="menu-scene__art"
          src="/assets/mal-eternal-menu.svg"
          alt={t("mainMenuAlt")}
        />
        <div className="menu-scene__shade" aria-hidden="true" />
        <div className="menu-scene__scan" aria-hidden="true" />
        <div className="menu-scene__status" aria-hidden="true">
          <span />
          {t("archiveOnline")}
          <span />
        </div>
        <CommandCenter />
      </section>

      <section className={`landing ${hasEntered ? "landing--active" : ""}`} aria-hidden={menuVisible}>
        <img
          className="landing__art"
          src="/assets/intro-landing.svg"
          alt={t("landingAlt")}
        />
        <div className="landing__shade" aria-hidden="true" />
        <div className="landing__embers" aria-hidden="true" />

        <section className="landing__message" aria-live="polite" aria-atomic="true">
          <div className={`decree ${currentLine ? "decree--visible" : ""}`}>
            <span className="decree__ornament" aria-hidden="true" />
            <p key={activeLine}>{currentLine ? t(currentLine.message) : ""}</p>
            <span className="decree__ornament decree__ornament--right" aria-hidden="true" />
          </div>
        </section>

        {!hasEntered ? (
          <section className="entry" aria-labelledby="entry-title">
            <p className="entry__eyebrow">{t("myAchievementsList")}</p>
            <h1 id="entry-title">MAL ETERNAL</h1>
            <p className="entry__copy">{t("everyVictory")}</p>
            <button className="entry__button" type="button" onClick={begin}>
              <span>{t("enterChronicle")}</span>
            </button>
            <p className="entry__sound-note">{t("soundNote")}</p>
          </section>
        ) : null}
      </section>

      <div className="laser-gate" aria-hidden="true">
        <div className="laser-gate__flare" />
        <div className="laser-gate__leaf laser-gate__leaf--left" />
        <div className="laser-gate__leaf laser-gate__leaf--right" />
        <div className="laser-gate__beam laser-gate__beam--left" />
        <div className="laser-gate__beam laser-gate__beam--right" />
        <div className="laser-gate__threshold" />
      </div>

      {audioEngaged ? (
        <div className="controls" aria-label={t("soundControls")}>
          <button type="button" onClick={togglePlayback}>
            {isPlaying ? t("pause") : t("resume")}
          </button>
          <span aria-hidden="true" />
          <button type="button" onClick={toggleMute}>
            {isMuted ? t("unmute") : t("mute")}
          </button>
        </div>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>

      {/* Timed narration text is rendered in the live region above. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src="/assets/hell-on-earth.mp3"
        preload="auto"
        onPlay={() => {
          setAudioEngaged(true);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setActiveLine(-1);
        }}
      />
    </main>
  );
}

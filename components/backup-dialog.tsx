"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  parseAchievementBackup,
  type AchievementBackup,
  type BackupParseResult,
} from "../lib/achievement-backup";
import { categoryText, formatNumber, formatUiDate } from "../lib/i18n";
import type { AchievementImportMode, AchievementImportResult } from "../types/achievement";
import { DialogFrame } from "./achievement-dialogs";
import { useLocale } from "./locale-provider";

const MAX_BACKUP_FILE_BYTES = 900_000;

export function BackupDialog({ onClose, onImported }: {
  onClose: () => void;
  onImported: (result: AchievementImportResult) => void;
}) {
  const { locale, t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<BackupParseResult | null>(null);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [requestError, setRequestError] = useState("");

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileName(file?.name ?? "");
    setParsed(null);
    setReplaceConfirmed(false);
    setRequestError("");
    if (!file) return;
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setParsed({ ok: false, error: t("backupFileTooLarge"), issues: [{ record: null, message: t("backupFileTooLarge") }] });
      return;
    }
    try {
      const json = JSON.parse(await file.text()) as unknown;
      setParsed(parseAchievementBackup(json, locale));
    } catch {
      setParsed({ ok: false, error: t("backupReadError"), issues: [{ record: null, message: t("backupReadError") }] });
    }
  };

  const importBackup = async (mode: AchievementImportMode) => {
    if (!parsed?.ok || (mode === "replace" && !replaceConfirmed)) return;
    setImporting(true);
    setRequestError("");
    try {
      const response = await fetch("/api/achievements/import", {
        method: "POST",
        headers: { "content-type": "application/json", "x-mal-locale": locale },
        body: JSON.stringify({ mode, backup: parsed.backup satisfies AchievementBackup }),
      });
      const result = await response.json() as AchievementImportResult & { error?: string };
      if (!response.ok) throw new Error(result.error || t("backupRequestError"));
      onImported({ imported: result.imported, skipped: result.skipped });
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : t("backupRequestError"));
    } finally {
      setImporting(false);
    }
  };

  const records = parsed?.ok ? parsed.backup.achievements : [];
  return (
    <DialogFrame
      wide
      eyebrow={t("backupEyebrow")}
      title={t("backupTitle")}
      description={t("backupDescription")}
      onClose={onClose}
    >
      <div className="backup-import">
        <input ref={inputRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void chooseFile(event)} />
        <button className="backup-file" type="button" onClick={() => inputRef.current?.click()}>
          <span aria-hidden="true">⇧</span>
          <strong>{fileName || t("chooseJsonFile")}</strong>
          <small>{t("jsonFileHint")}</small>
        </button>

        {parsed && !parsed.ok ? (
          <div className="backup-errors" role="alert">
            <strong>{parsed.error}</strong>
            <ul>{parsed.issues.slice(0, 8).map((issue, index) => <li key={`${issue.record ?? "file"}-${index}`}>{issue.record ? `${t("backupRecordNumber", { number: formatNumber(issue.record, locale) })}: ` : ""}{issue.message}</li>)}</ul>
          </div>
        ) : null}

        {parsed?.ok ? (
          <>
            <section className="backup-preview" aria-label={t("backupPreview")}>
              <header><span>{t("backupPreview")}</span><strong>{records.length ? t("backupReady", { count: formatNumber(records.length, locale) }) : t("backupEmpty")}</strong></header>
              {records.slice(0, 3).map((record, index) => (
                <article key={`${record.achievedOn}-${record.title}-${index}`}>
                  <time>{formatUiDate(record.achievedOn, locale)}</time>
                  <div><strong>{record.title}</strong><small>{categoryText(record.category, record.customCategory, locale)}</small></div>
                </article>
              ))}
              {records.length > 3 ? <p>{t("backupMoreRecords", { count: formatNumber(records.length - 3, locale) })}</p> : null}
            </section>

            <label className="backup-replace-confirm">
              <input type="checkbox" checked={replaceConfirmed} onChange={(event) => setReplaceConfirmed(event.target.checked)} />
              <span>{t("backupReplaceWarning")}</span>
            </label>
            {requestError ? <p className="achievement-form__error" role="alert">{requestError}</p> : null}
            <div className="backup-actions">
              <button type="button" className="button-secondary" onClick={onClose}>{t("cancel")}</button>
              <button type="button" className="button-secondary" disabled={importing} onClick={() => void importBackup("merge")}>{importing ? t("backupImporting") : t("backupMerge")}</button>
              <button type="button" className="button-danger" disabled={importing || !replaceConfirmed} onClick={() => void importBackup("replace")}>{importing ? t("backupImporting") : t("backupReplace")}</button>
            </div>
          </>
        ) : null}
      </div>
    </DialogFrame>
  );
}

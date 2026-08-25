"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  CURATED_CATEGORIES,
  IMPORTANCE_LEVELS,
  type Achievement,
  type AchievementInput,
  type ApiError,
} from "../types/achievement";
import { categoryText, formatUiDate, importanceText } from "../lib/i18n";
import { DoomSelect } from "./doom-select";
import { useLocale } from "./locale-provider";

type DialogFrameProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
};

export function DialogFrame({
  title,
  eyebrow,
  description,
  children,
  onClose,
  wide = false,
}: DialogFrameProps) {
  const { t } = useLocale();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("button, input, select, textarea")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        ref={dialogRef}
        className={`dialog-frame ${wide ? "dialog-frame--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button className="dialog-frame__close" type="button" onClick={onClose} aria-label={t("closeDialog")}>×</button>
        {eyebrow ? <p className="dialog-frame__eyebrow">{eyebrow}</p> : null}
        <h2 id={titleId}>{title}</h2>
        {description ? <p className="dialog-frame__description">{description}</p> : null}
        {children}
      </div>
    </div>
  );
}

type AchievementDialogProps = {
  achievedOn: string;
  achievement?: Achievement | null;
  customCategories: readonly string[];
  onClose: () => void;
  onSaved: (achievement: Achievement) => void;
};

export function AchievementDialog({
  achievedOn,
  achievement,
  customCategories,
  onClose,
  onSaved,
}: AchievementDialogProps) {
  const { locale, t } = useLocale();
  const [form, setForm] = useState(() => toFormState(achievement, achievedOn));
  const [fieldErrors, setFieldErrors] = useState<ApiError["fieldErrors"]>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const setField = (name: keyof AchievementInput, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload: AchievementInput = {
      title: form.title,
      description: form.description,
      achievedOn: form.achievedOn,
      startedOn: form.startedOn || null,
      finishedOn: form.finishedOn || null,
      category: form.category as AchievementInput["category"],
      customCategory: form.category === "custom" ? form.customCategory : null,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      importance: form.importance as AchievementInput["importance"],
      notes: form.notes || null,
    };
    try {
      const response = await fetch(
        achievement ? `/api/achievements/${achievement.id}` : "/api/achievements",
        {
          method: achievement ? "PATCH" : "POST",
          headers: { "content-type": "application/json", "x-mal-locale": locale },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json() as { achievement?: Achievement } & ApiError;
      if (!response.ok || !result.achievement) {
        setError(result.error || t("saveError"));
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      onSaved(result.achievement);
    } catch {
      setError(t("archiveReachError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogFrame
      wide
      eyebrow={achievement ? t("editRecord") : t("inscribeVictory")}
      title={achievement ? achievement.title : t("recordAchievement")}
      description={t("completionDayPrefix", { date: formatUiDate(form.achievedOn, locale) })}
      onClose={onClose}
    >
      <form className="achievement-form" onSubmit={submit} noValidate>
        <FormField label={t("achievementTitle")} error={fieldErrors?.title} required>
          <input value={form.title} onChange={(event) => setField("title", event.target.value)} maxLength={120} />
        </FormField>
        <FormField label={t("description")} error={fieldErrors?.description} required span>
          <textarea value={form.description} onChange={(event) => setField("description", event.target.value)} rows={3} maxLength={2000} />
        </FormField>
        <FormField label={t("completionDay")} error={fieldErrors?.achievedOn} required>
          <input type="date" min="2022-01-01" value={form.achievedOn} onChange={(event) => setField("achievedOn", event.target.value)} />
        </FormField>
        <FormField label={t("importance")} error={fieldErrors?.importance} required>
          <DoomSelect ariaLabel={t("importance")} className="doom-select--form" value={form.importance} onChange={(value) => setField("importance", value)} options={IMPORTANCE_LEVELS.map((level) => ({ value: level, label: importanceText(level, locale), meta: level === "milestone" ? t("hallOfLegends") : undefined }))} />
        </FormField>
        <FormField label={t("effortStarted")} error={fieldErrors?.startedOn}>
          <input type="date" value={form.startedOn} onChange={(event) => setField("startedOn", event.target.value)} />
        </FormField>
        <FormField label={t("effortFinished")} error={fieldErrors?.finishedOn}>
          <input type="date" value={form.finishedOn} onChange={(event) => setField("finishedOn", event.target.value)} />
        </FormField>
        <FormField label={t("category")} error={fieldErrors?.category} required>
          <DoomSelect ariaLabel={t("category")} className="doom-select--form" value={form.category} onChange={(value) => setField("category", value)} options={[...CURATED_CATEGORIES.map((category) => ({ value: category, label: categoryText(category, null, locale) })), { value: "custom", label: t("customCategory"), meta: t("forgeCategory") }]} />
        </FormField>
        {form.category === "custom" ? (
          <FormField label={t("customCategory")} error={fieldErrors?.customCategory} required>
            <input
              list="custom-category-list"
              value={form.customCategory}
              onChange={(event) => setField("customCategory", event.target.value)}
              maxLength={50}
            />
            <datalist id="custom-category-list">
              {customCategories.map((category) => <option key={category} value={category} />)}
            </datalist>
          </FormField>
        ) : null}
        <FormField label={t("tags")} hint={t("tagsHint")} error={fieldErrors?.tags} span={form.category !== "custom"}>
          <input value={form.tags} onChange={(event) => setField("tags", event.target.value)} placeholder={t("tagsPlaceholder")} />
        </FormField>
        <FormField label={t("notes")} error={fieldErrors?.notes} span>
          <textarea value={form.notes} onChange={(event) => setField("notes", event.target.value)} rows={3} maxLength={4000} />
        </FormField>
        {error ? <p className="achievement-form__error" role="alert">{error}</p> : null}
        <div className="achievement-form__actions">
          <button type="button" className="button-secondary" onClick={onClose}>{t("cancel")}</button>
          <button type="submit" className="button-primary" disabled={saving}>{saving ? t("inscribing") : achievement ? t("updateRecord") : t("makeEternal")}</button>
        </div>
      </form>
    </DialogFrame>
  );
}

export function ConfirmDeleteDialog({ achievement, onClose, onConfirm, deleting }: {
  achievement: Achievement;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const { t } = useLocale();
  return (
    <DialogFrame
      eyebrow={t("dangerZone")}
      title={t("eraseRecord")}
      description={t("eraseDescription", { title: achievement.title })}
      onClose={onClose}
    >
      <div className="confirm-actions">
        <button type="button" className="button-secondary" onClick={onClose}>{t("keepRecord")}</button>
        <button type="button" className="button-danger" onClick={onConfirm} disabled={deleting}>{deleting ? t("erasing") : t("erasePermanently")}</button>
      </div>
    </DialogFrame>
  );
}

function FormField({ label, hint, error, required, span = false, children }: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  span?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`form-field ${span ? "form-field--span" : ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      {children}
      {hint && !error ? <small>{hint}</small> : null}
      {error ? <small className="form-field__error">{error}</small> : null}
    </label>
  );
}

function toFormState(achievement: Achievement | null | undefined, achievedOn: string) {
  return {
    title: achievement?.title ?? "",
    description: achievement?.description ?? "",
    achievedOn: achievement?.achievedOn ?? achievedOn,
    startedOn: achievement?.startedOn ?? "",
    finishedOn: achievement?.finishedOn ?? "",
    category: achievement?.category ?? "personal",
    customCategory: achievement?.customCategory ?? "",
    tags: achievement?.tags.join(", ") ?? "",
    importance: achievement?.importance ?? "normal",
    notes: achievement?.notes ?? "",
  };
}

import { parseAchievementBackup } from "../../../../lib/achievement-backup";
import { getRequestUserId, importAchievements } from "../../../../lib/achievement-store";
import { localeFromRequest, translate } from "../../../../lib/i18n";
import type { AchievementImportMode } from "../../../../types/achievement";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const locale = localeFromRequest(request);
  const userId = await getRequestUserId();
  if (!userId) return Response.json({ error: translate(locale, "signInRecord") }, { status: 401 });

  try {
    const body = await request.json() as { mode?: unknown; backup?: unknown };
    const mode = body.mode as AchievementImportMode;
    if (mode !== "merge" && mode !== "replace") {
      return Response.json({ error: translate(locale, "backupRequestError") }, { status: 400 });
    }
    const parsed = parseAchievementBackup(body.backup, locale);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
    }
    return Response.json(await importAchievements(userId, parsed.backup.achievements, mode));
  } catch {
    return Response.json({ error: translate(locale, "backupRequestError") }, { status: 500 });
  }
}

import { createAchievement, getRequestUserId, listAchievements } from "../../../lib/achievement-store";
import { validateAchievementInput } from "../../../lib/achievement-validation";
import type { AchievementFilters, AchievementImportance, SeasonKey } from "../../../types/achievement";
import { localeFromRequest, translate, type Locale } from "../../../lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const locale = localeFromRequest(request);
  const userId = await getRequestUserId();
  if (!userId) return Response.json({ error: translate(locale, "signInChronicle") }, { status: 401 });
  try {
    const params = new URL(request.url).searchParams;
    const cycleValue = Number(params.get("cycle"));
    const monthValue = Number(params.get("month"));
    const filters: AchievementFilters = {
      cycle: Number.isInteger(cycleValue) ? cycleValue : undefined,
      season: (params.get("season") || undefined) as SeasonKey | undefined,
      month: monthValue >= 1 && monthValue <= 12 ? monthValue : undefined,
      query: params.get("q")?.trim() || undefined,
      category: params.get("category")?.trim() || undefined,
      importance: (params.get("importance") || undefined) as AchievementImportance | undefined,
      tag: params.get("tag")?.trim() || undefined,
      milestonesOnly: params.get("milestones") === "true",
    };
    return Response.json({ achievements: await listAchievements(userId, filters) });
  } catch (error) {
    return routeError(error, locale);
  }
}

export async function POST(request: Request) {
  const locale = localeFromRequest(request);
  const userId = await getRequestUserId();
  if (!userId) return Response.json({ error: translate(locale, "signInRecord") }, { status: 401 });
  try {
    const validation = validateAchievementInput(await request.json(), locale);
    if (!validation.ok) {
      return Response.json(
        { error: validation.error, fieldErrors: validation.fieldErrors },
        { status: 400 },
      );
    }
    const achievement = await createAchievement(userId, validation.value);
    return Response.json({ achievement }, { status: 201 });
  } catch (error) {
    return routeError(error, locale);
  }
}

function routeError(error: unknown, locale: Locale) {
  void error;
  return Response.json({ error: translate(locale, "archiveUnavailable") }, { status: 500 });
}

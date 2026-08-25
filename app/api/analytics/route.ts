import { getRequestUserId, listAchievements } from "../../../lib/achievement-store";
import { getActiveCycleStart, summarizeAchievements } from "../../../lib/chronicle";
import { localeFromRequest, translate } from "../../../lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const locale = localeFromRequest(request);
  const userId = await getRequestUserId();
  if (!userId) return Response.json({ error: translate(locale, "signInAnalytics") }, { status: 401 });
  try {
    const cycleValue = Number(new URL(request.url).searchParams.get("cycle"));
    const cycle = Number.isInteger(cycleValue) ? cycleValue : getActiveCycleStart();
    const achievements = await listAchievements(userId);
    return Response.json({ summary: summarizeAchievements(achievements, cycle) });
  } catch (error) {
    void error;
    return Response.json({ error: translate(locale, "analyticsUnavailable") }, { status: 500 });
  }
}

import {
  deleteAchievement,
  getRequestUserId,
  updateAchievement,
} from "../../../../lib/achievement-store";
import { validateAchievementInput } from "../../../../lib/achievement-validation";
import { localeFromRequest, translate, type Locale } from "../../../../lib/i18n";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const locale = localeFromRequest(request);
  const userId = await getRequestUserId();
  if (!userId) return Response.json({ error: translate(locale, "signInUpdate") }, { status: 401 });
  try {
    const validation = validateAchievementInput(await request.json(), locale);
    if (!validation.ok) {
      return Response.json(
        { error: validation.error, fieldErrors: validation.fieldErrors },
        { status: 400 },
      );
    }
    const { id } = await context.params;
    const achievement = await updateAchievement(userId, id, validation.value);
    if (!achievement) return Response.json({ error: translate(locale, "notFound") }, { status: 404 });
    return Response.json({ achievement });
  } catch (error) {
    return routeError(error, locale);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const locale = localeFromRequest(request);
  const userId = await getRequestUserId();
  if (!userId) return Response.json({ error: translate(locale, "signInUpdate") }, { status: 401 });
  try {
    const { id } = await context.params;
    const deleted = await deleteAchievement(userId, id);
    if (!deleted) return Response.json({ error: translate(locale, "notFound") }, { status: 404 });
    return Response.json({ deleted: true });
  } catch (error) {
    return routeError(error, locale);
  }
}

function routeError(error: unknown, locale: Locale) {
  void error;
  return Response.json({ error: translate(locale, "archiveUnavailable") }, { status: 500 });
}

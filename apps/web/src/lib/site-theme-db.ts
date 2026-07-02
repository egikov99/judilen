import { db, siteThemeSettings } from "@judilen/db";
import { eq } from "drizzle-orm";
import { DEFAULT_SITE_THEME, type SiteTheme } from "./site-theme";

export const SITE_THEME_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

const selection = {
  primaryColor: siteThemeSettings.primaryColor,
  buttonColor: siteThemeSettings.buttonColor,
  buttonHoverColor: siteThemeSettings.buttonHoverColor,
  backgroundColor: siteThemeSettings.backgroundColor,
  cardColor: siteThemeSettings.cardColor,
  textColor: siteThemeSettings.textColor,
  accentColor: siteThemeSettings.accentColor,
  headerColor: siteThemeSettings.headerColor,
  footerColor: siteThemeSettings.footerColor
};

export async function getSiteTheme(): Promise<SiteTheme> {
  const [theme] = await db.select(selection).from(siteThemeSettings)
    .where(eq(siteThemeSettings.id, SITE_THEME_SETTINGS_ID)).limit(1);
  return theme ?? { ...DEFAULT_SITE_THEME };
}

export async function saveSiteTheme(theme: SiteTheme): Promise<SiteTheme> {
  const [saved] = await db.insert(siteThemeSettings).values({
    id: SITE_THEME_SETTINGS_ID,
    ...theme
  }).onConflictDoUpdate({
    target: siteThemeSettings.id,
    set: { ...theme, updatedAt: new Date() }
  }).returning(selection);
  return saved;
}

export function resetSiteTheme() {
  return saveSiteTheme({ ...DEFAULT_SITE_THEME });
}

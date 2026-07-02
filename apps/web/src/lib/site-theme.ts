import { z } from "zod";

export const DEFAULT_SITE_THEME = {
  primaryColor: "#154212",
  buttonColor: "#154212",
  buttonHoverColor: "#23501E",
  backgroundColor: "#F9FAF2",
  cardColor: "#FFFFFF",
  textColor: "#191C18",
  accentColor: "#974730",
  headerColor: "#F9FAF2",
  footerColor: "#0B2410"
} as const;

export type SiteTheme = { [Key in keyof typeof DEFAULT_SITE_THEME]: string };

export const SITE_THEME_CSS_VARIABLES: Record<keyof SiteTheme, `--color-${string}`> = {
  primaryColor: "--color-primary",
  buttonColor: "--color-button",
  buttonHoverColor: "--color-button-hover",
  backgroundColor: "--color-background",
  cardColor: "--color-card",
  textColor: "--color-text",
  accentColor: "--color-accent",
  headerColor: "--color-header",
  footerColor: "--color-footer"
};

const hexColor = z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Введите HEX в формате #RRGGBB")
  .transform((value) => value.toUpperCase());

export const siteThemeSchema = z.object({
  primaryColor: hexColor,
  buttonColor: hexColor,
  buttonHoverColor: hexColor,
  backgroundColor: hexColor,
  cardColor: hexColor,
  textColor: hexColor,
  accentColor: hexColor,
  headerColor: hexColor,
  footerColor: hexColor
}).strict();

export function applySiteTheme(theme: SiteTheme, target: HTMLElement = document.documentElement) {
  for (const [key, variable] of Object.entries(SITE_THEME_CSS_VARIABLES) as Array<[keyof SiteTheme, string]>) {
    target.style.setProperty(variable, theme[key]);
  }
}

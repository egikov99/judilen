import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_THEME, siteThemeSchema } from "@/lib/site-theme";

describe("site theme validation", () => {
  it("accepts and normalizes the default palette", () => {
    const result = siteThemeSchema.parse({
      ...DEFAULT_SITE_THEME,
      primaryColor: "#abcdef"
    });

    expect(result.primaryColor).toBe("#ABCDEF");
  });

  it.each(["154212", "#FFF", "#GGGGGG", "#12345678", "red"])(
    "rejects invalid HEX value %s",
    (primaryColor) => {
      expect(siteThemeSchema.safeParse({ ...DEFAULT_SITE_THEME, primaryColor }).success).toBe(false);
    }
  );

  it("requires every theme color", () => {
    const incompleteTheme = Object.fromEntries(
      Object.entries(DEFAULT_SITE_THEME).filter(([key]) => key !== "footerColor")
    );
    expect(siteThemeSchema.safeParse(incompleteTheme).success).toBe(false);
  });
});

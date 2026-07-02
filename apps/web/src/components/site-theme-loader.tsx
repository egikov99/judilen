"use client";

import { useEffect } from "react";
import { applySiteTheme, siteThemeSchema } from "@/lib/site-theme";

export function SiteThemeLoader() {
  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/site-theme", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Theme API is unavailable");
        return response.json();
      })
      .then((value) => {
        const parsed = siteThemeSchema.safeParse(value);
        if (parsed.success) applySiteTheme(parsed.data);
      })
      .catch(() => {
        // CSS fallbacks remain active when the theme endpoint is unavailable.
      });

    return () => controller.abort();
  }, []);

  return null;
}

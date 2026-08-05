"use client";

import * as React from "react";

export function ThemeClient({
  initialTheme = "light",
  brandColor = null,
  fontFamily = null,
}: {
  initialTheme?: string;
  brandColor?: string | null;
  fontFamily?: string | null;
}) {
  React.useEffect(() => {
    const root = document.documentElement;
    if (initialTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    if (brandColor) {
      root.style.setProperty("--brand-color", brandColor);
    }
    if (fontFamily) {
      root.style.setProperty("--font-family", fontFamily);
      root.style.fontFamily = fontFamily;
    }
  }, [initialTheme, brandColor, fontFamily]);

  return null;
}

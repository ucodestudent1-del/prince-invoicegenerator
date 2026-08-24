"use client";

import * as React from "react";

export function ThemeClient({
  initialTheme = "light",
  brandColor = null,
}: {
  initialTheme?: string;
  brandColor?: string | null;
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
  }, [initialTheme, brandColor]);

  return null;
}

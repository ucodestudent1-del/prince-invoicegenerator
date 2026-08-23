"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: string;
  onToggle: (theme: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onToggle(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export function ThemeToggleForm({ current }: { current: string }) {
  const [theme, setTheme] = React["useState"](current);
  const [saving, setSaving] = React["useState"](false);

  async function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setSaving(true);
    setTheme(next);
    try {
      const res = await fetch("/api/customization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON["stringify"]({ key: "theme", value: next }),
      });
      if (!res["ok"]) {
        // Even if the API returns an error, the server may have set a cookie fallback
        // for when the theme column doesn't exist. Reload to pick up the cookie.
      }
      window["location"]["reload"]();
    } catch (err) {
      // Network error — reload to try again
      window["location"]["reload"]();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} disabled={saving} aria-label="Toggle theme">
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

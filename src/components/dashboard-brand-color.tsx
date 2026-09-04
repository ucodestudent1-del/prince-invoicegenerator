"use client";

import * as React from "react";

/**
 * Dashboard-only brand color applicator.
 *
 * The marketing `ThemeClient` (in the locale layout) handles the dark/light
 * class from a cookie. This component layers the dashboard's `brandColor` on
 * top by writing the `--brand-color` CSS variable on the root element, so any
 * page inside the dashboard can read `var(--brand-color)` in styles.
 */
export function DashboardBrandColor({ brandColor }: { brandColor: string | null }) {
	React.useEffect(() => {
		const root = document.documentElement;
		if (brandColor) {
			root.style.setProperty("--brand-color", brandColor);
		} else {
			root.style.removeProperty("--brand-color");
		}
	}, [brandColor]);
	return null;
}

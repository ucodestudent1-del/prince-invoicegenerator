import type { MetadataRoute } from "next";

const BASE = "https://princeinvoicegenerator.up.railway.app";
const LOCALES = ["en", "fr", "es", "de"] as const;

/**
 * Top-level sitemap aggregation.
 *
 * Per-locale sitemap entries live at `src/app/[locale]/sitemap.ts`. To keep
 * `robots.txt` referencing a real URL, we expose a single sitemap at the root
 * that lists every (locale, path) combination. Crawlers that only fetch
 * `/sitemap.xml` see the full surface area.
 */
export default function sitemap(): MetadataRoute.Sitemap {
	const now = new Date();
	const topLevel: Array<{
		path: string;
		changeFrequency: "weekly" | "monthly";
		priority: number;
	}> = [
		{ path: "/", changeFrequency: "weekly", priority: 1 },
		{ path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
		{ path: "/privacy", changeFrequency: "monthly", priority: 0.5 },
		{ path: "/terms", changeFrequency: "monthly", priority: 0.5 },
		{ path: "/support", changeFrequency: "monthly", priority: 0.5 },
	];

	return LOCALES.flatMap((locale) =>
		topLevel.map((entry) => ({
			url: `${BASE}/${locale}${entry.path === "/" ? "" : entry.path}`,
			lastModified: now,
			changeFrequency: entry.changeFrequency,
			priority: entry.priority,
		}))
	);
}

/**
 * Cache identifiers for the dashboard server action.
 *
 * Defined in a separate (non-`"use server"`) module so the constants can be
 * re-exported and imported from anywhere without violating Next.js' "only
 * async functions" rule for server action files.
 */

export const DASHBOARD_CACHE_TAG_PREFIX = "dashboard:";
export const DASHBOARD_CACHE_TTL_SECONDS = 60;

/** Build the cache tag for a specific organization. */
export function dashboardCacheTag(orgId: string): string {
	return `${DASHBOARD_CACHE_TAG_PREFIX}${orgId}`;
}

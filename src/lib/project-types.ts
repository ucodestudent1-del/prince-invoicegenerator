/**
 * Project work categories.
 *
 * Mirrors the Prisma `ProjectType` enum. Kept as a separate constant so
 * client components can render the option list without needing the Prisma
 * client (which would otherwise bloat the client bundle).
 */

export const PROJECT_TYPES = [
  "RESIDENTIAL_REMODEL",
  "NEW_CONSTRUCTION",
  "COMMERCIAL",
  "ROOFING",
  "ELECTRICAL",
  "PLUMBING",
  "HVAC",
  "LANDSCAPING",
  "GENERAL_CONTRACTING",
  "OTHER",
] as const;

export type ProjectTypeKey = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABEL: Record<ProjectTypeKey, string> = {
  RESIDENTIAL_REMODEL: "Residential Remodel",
  NEW_CONSTRUCTION: "New Construction",
  COMMERCIAL: "Commercial",
  ROOFING: "Roofing",
  ELECTRICAL: "Electrical",
  PLUMBING: "Plumbing",
  HVAC: "HVAC",
  LANDSCAPING: "Landscaping",
  GENERAL_CONTRACTING: "General Contracting",
  OTHER: "Other",
};

export const DEFAULT_PROJECT_TYPE: ProjectTypeKey = "GENERAL_CONTRACTING";

export function isProjectType(value: unknown): value is ProjectTypeKey {
  return typeof value === "string" && (PROJECT_TYPES as readonly string[]).includes(value);
}

export function coerceProjectType(value: unknown): ProjectTypeKey {
  return isProjectType(value) ? value : DEFAULT_PROJECT_TYPE;
}

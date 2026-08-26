export const PAPER_SIZES = {
  A4: { width: "210mm", height: "297mm" },
  Letter: { width: "215.9mm", height: "279.4mm" },
  Legal: { width: "215.9mm", height: "355.6mm" },
} as const;

export type PaperSize = "A4" | "Letter" | "Legal";

export function resolvePaperSize(value: string | null | undefined): PaperSize {
  if (value === "Legal" || value === "Letter") return value;
  return "A4";
}

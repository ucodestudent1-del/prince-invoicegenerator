/**
 * Image upload validation helpers (Plan A9).
 *
 * Pure functions extracted from the photos route so they can be unit-tested
 * without spinning up Next.js, R2, or a multipart parser. The route handler
 * remains the single integration point; this module is a defence-in-depth
 * library that the route composes.
 */

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "heic",
  "heif",
]);

export const ALLOWED_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function extensionFromName(name: string): string {
  const dot = name["lastIndexOf"](".");
  if (dot < 0 || dot === name["length"] - 1) return "";
  return name["slice"](dot + 1).toLowerCase();
}

/**
 * Sniff the first 16 bytes of the upload to verify it really is the format
 * the Content-Type / extension claim. Returns the matched extension or null.
 *
 * The check is intentionally minimal (no dependency on `file-type`) so the
 * API route stays Node-runtime-friendly and easy to audit.
 */
export function sniffImageType(buffer: Buffer): string | null {
  if (buffer["length"] < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return "png";
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "webp";
  }
  // HEIC / HEIF: ISO-BMFF "ftyp" at offset 4
  if (
    buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70
  ) {
    const brand = buffer["slice"](8, 12).toString("ascii").toLowerCase();
    if (
      brand["startsWith"]("heic") ||
      brand["startsWith"]("heix") ||
      brand["startsWith"]("hevc") ||
      brand["startsWith"]("hevx")
    ) {
      return "heic";
    }
    if (brand["startsWith"]("mif1") || brand["startsWith"]("heif")) {
      return "heif";
    }
  }
  return null;
}

/** Normalize a JPEG/WEBP/etc. extension to a canonical form for the R2 key. */
export function canonicalExtension(ext: string): string {
  if (ext === "jpeg") return "jpg";
  if (ext === "heif") return "heic";
  return ext;
}

/**
 * Decide whether an upload should be accepted. Returns null on success, or
 * an error message describing the first failing check. The checks are
 * deliberately layered — every layer must pass, because each one alone is
 * bypassable (the extension is a client-controlled hint, the content-type
 * is too, and the magic-byte sniff is a small fixed-format set).
 */
export function validatePhotoUpload(input: {
  filename: string;
  contentType: string;
  size: number;
  buffer: Buffer;
}): { ok: true; extension: string; storedContentType: string } | { ok: false; reason: string } {
  if (input["size"] > MAX_PHOTO_BYTES) {
    return { ok: false, reason: "File too large" };
  }
  const claimedExt = extensionFromName(input["filename"]);
  if (!ALLOWED_EXTENSIONS["has"](claimedExt)) {
    return { ok: false, reason: "Unsupported file type" };
  }
  const claimedType = (input["contentType"] || "")["toLowerCase"]();
  if (!ALLOWED_CONTENT_TYPES["has"](claimedType)) {
    return { ok: false, reason: "Unsupported content type" };
  }
  const sniffed = sniffImageType(input["buffer"]);
  if (!sniffed) {
    return { ok: false, reason: "File contents do not match a supported image format" };
  }
  if (canonicalExtension(sniffed) !== canonicalExtension(claimedExt)) {
    return { ok: false, reason: "Declared type does not match file contents" };
  }
  const finalExt = canonicalExtension(sniffed);
  return {
    ok: true,
    extension: finalExt,
    storedContentType: `image/${finalExt === "jpg" ? "jpeg" : finalExt}`,
  };
}

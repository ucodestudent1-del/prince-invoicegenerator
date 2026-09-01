import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_BYTES,
  canonicalExtension,
  extensionFromName,
  sniffImageType,
  validatePhotoUpload,
} from "@/lib/photo-validation";

function pngBytes(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
}

function jpegBytes(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
}

function webpBytes(): Buffer {
  return Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
  ]);
}

function heicBytes(): Buffer {
  return Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    0x68, 0x65, 0x69, 0x63,
  ]);
}

function exeBytes(): Buffer {
  return Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00");
}

describe("extensionFromName", () => {
  it("lowercases and strips the last dot segment", () => {
    expect(extensionFromName("Photo.PNG"))["toBe"]("png");
    expect(extensionFromName("photo.tar.gz"))["toBe"]("gz");
  });
  it("returns empty when no extension is present", () => {
    expect(extensionFromName("README"))["toBe"]("");
    expect(extensionFromName("trailing."))["toBe"]("");
  });
});

describe("sniffImageType", () => {
  it("recognises PNG magic bytes", () => {
    expect(sniffImageType(pngBytes()))["toBe"]("png");
  });
  it("recognises JPEG magic bytes", () => {
    expect(sniffImageType(jpegBytes()))["toBe"]("jpg");
  });
  it("recognises WEBP magic bytes", () => {
    expect(sniffImageType(webpBytes()))["toBe"]("webp");
  });
  it("recognises HEIC magic bytes", () => {
    expect(sniffImageType(heicBytes()))["toBe"]("heic");
  });
  it("rejects an EXE masquerading as an image", () => {
    expect(sniffImageType(exeBytes()))["toBe"](null);
  });
  it("rejects a buffer that is too small to sniff", () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8])))["toBe"](null);
  });
});

describe("canonicalExtension", () => {
  it("collapses jpeg -> jpg and heif -> heic", () => {
    expect(canonicalExtension("jpeg"))["toBe"]("jpg");
    expect(canonicalExtension("heif"))["toBe"]("heic");
  });
  it("passes through png/webp/heic unchanged", () => {
    expect(canonicalExtension("png"))["toBe"]("png");
    expect(canonicalExtension("webp"))["toBe"]("webp");
    expect(canonicalExtension("heic"))["toBe"]("heic");
  });
});

describe("validatePhotoUpload", () => {
  it("accepts a real PNG with matching extension and content-type", () => {
    const result = validatePhotoUpload({
      filename: "shot.png",
      contentType: "image/png",
      size: pngBytes()["length"],
      buffer: pngBytes(),
    });
    expect(result["ok"])["toBe"](true);
    if (result["ok"]) {
      expect(result["extension"])["toBe"]("png");
      expect(result["storedContentType"])["toBe"]("image/png");
    }
  });

  it("rejects an upload whose extension is not on the allowlist", () => {
    const result = validatePhotoUpload({
      filename: "shell.exe",
      contentType: "image/png",
      size: 8,
      buffer: pngBytes(),
    });
    expect(result["ok"])["toBe"](false);
  });

  it("rejects an upload whose content-type is not on the allowlist", () => {
    const result = validatePhotoUpload({
      filename: "shot.png",
      contentType: "application/octet-stream",
      size: 8,
      buffer: pngBytes(),
    });
    expect(result["ok"])["toBe"](false);
  });

  it("rejects an upload whose contents do not match the declared type", () => {
    const result = validatePhotoUpload({
      filename: "shot.png",
      contentType: "image/png",
      size: 12,
      buffer: jpegBytes(),
    });
    expect(result["ok"])["toBe"](false);
  });

  it("rejects an upload that exceeds the size cap", () => {
    const oversized = Buffer.alloc(MAX_PHOTO_BYTES + 1, 0);
    const result = validatePhotoUpload({
      filename: "shot.png",
      contentType: "image/png",
      size: oversized["length"],
      buffer: oversized,
    });
    expect(result["ok"])["toBe"](false);
  });

  it("rejects an EXE renamed to .png", () => {
    const result = validatePhotoUpload({
      filename: "evil.png",
      contentType: "image/png",
      size: exeBytes()["length"],
      buffer: exeBytes(),
    });
    expect(result["ok"])["toBe"](false);
  });

  it("canonicalises jpeg -> jpg and sets the matching stored content-type", () => {
    const result = validatePhotoUpload({
      filename: "shot.jpeg",
      contentType: "image/jpeg",
      size: jpegBytes()["length"],
      buffer: jpegBytes(),
    });
    expect(result["ok"])["toBe"](true);
    if (result["ok"]) {
      expect(result["extension"])["toBe"]("jpg");
      expect(result["storedContentType"])["toBe"]("image/jpeg");
    }
  });
});

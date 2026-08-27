import { logError } from "@/lib/logging";
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process["env"]["R2_ACCOUNT_ID"];

export interface UploadPdfResult {
  url: string;
  key: string;
  size: number;
}

export async function uploadPdfToR2(
  pdfBuffer: Buffer,
  invoiceNumber: string
): Promise<UploadPdfResult> {
  if (!R2_BUCKET) {
    throw new Error("R2 storage is not configured. Please set R2_BUCKET.");
  }

  const key = `invoices/${invoiceNumber}/${Date["now"]()}-${invoiceNumber}.pdf`;

  try {
    await r2["send"](
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: pdfBuffer,
        ContentType: "application/pdf",
      })
    );

    const publicUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${key}`
      : R2_ACCOUNT_ID
        ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`
        : key;

    return {
      url: publicUrl,
      key,
      size: pdfBuffer["length"],
    };
  } catch (err) {
    logError("uploadPdfToR2", err);
    throw err;
  }
}

export async function getPdfFromR2(key: string): Promise<Buffer | null> {
  if (!R2_BUCKET) return null;

  try {
    const res = await r2["send"](
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
    );
    if (!res["Body"]) return null;
    const bytes = await res["Body"]["transformToByteArray"]();
    return Buffer["from"](bytes);
  } catch (err) {
    logError("getPdfFromR2", err);
    return null;
  }
}

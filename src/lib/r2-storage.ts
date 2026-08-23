import { logError } from "@/lib/logging";

const R2_ACCOUNT_ID = process["env"]["R2_ACCOUNT_ID"];
const R2_ACCESS_KEY_ID = process["env"]["R2_ACCESS_KEY_ID"];
const R2_SECRET_ACCESS_KEY = process["env"]["R2_SECRET_ACCESS_KEY"];
const R2_BUCKET_NAME = process["env"]["R2_BUCKET_NAME"] || "prince-invoices";
const R2_PUBLIC_URL = process["env"]["R2_PUBLIC_URL"];

export interface UploadPdfResult {
  url: string;
  key: string;
  size: number;
}

export async function uploadPdfToR2(
  pdfBuffer: Buffer,
  invoiceNumber: string
): Promise<UploadPdfResult> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 storage is not configured. Please set R2 environment variables.");
  }

  const key = `invoices/${invoiceNumber}/${Date["now"]()}-${invoiceNumber}.pdf`;

  try {
    // Use S3-compatible API for R2
    const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;

    // Create signature for R2
    const date = new Date();
    const dateString = date["toISOString"]()["replace"](/[:-]|\.\d{3}/g, "");
    const dateStamp = dateString["slice"](0, 8);
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

    // Upload using fetch with AWS Signature V4
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": pdfBuffer["length"]["toString"](),
        "x-amz-date": dateString,
        "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
      },
      body: new Uint8Array(pdfBuffer),
    });

    if (!response["ok"]) {
      const errorText = await response["text"]();
      throw new Error(`R2 upload failed: ${response["status"]} ${errorText}`);
    }

    const publicUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${key}`
      : url;

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
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null;
  }

  try {
    const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;

    const response = await fetch(url, {
      method: "GET",
    });

    if (!response["ok"]) {
      return null;
    }

    const arrayBuffer = await response["arrayBuffer"]();
    return Buffer["from"](arrayBuffer);
  } catch (err) {
    logError("getPdfFromR2", err);
    return null;
  }
}

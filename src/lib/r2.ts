import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process["env"]["R2_ACCOUNT_ID"];
const R2_ACCESS_KEY_ID = process["env"]["R2_ACCESS_KEY_ID"];
const R2_SECRET_ACCESS_KEY = process["env"]["R2_SECRET_ACCESS_KEY"];
export const R2_BUCKET = process["env"]["R2_BUCKET"];
export const R2_PUBLIC_URL = process["env"]["R2_PUBLIC_URL"]; // e.g. https://<id>.r2.cloudflarestorage.com

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: R2_SECRET_ACCESS_KEY ?? "",
  },
});

export function isR2Configured() {
  return Boolean(
    R2_ACCOUNT_ID &&
      R2_ACCESS_KEY_ID &&
      R2_SECRET_ACCESS_KEY &&
      R2_BUCKET &&
      R2_PUBLIC_URL
  );
}

export async function uploadToR2(key: string, body: Buffer, contentType: string) {
  if (!R2_BUCKET) throw new Error("R2_BUCKET is not configured");
  if (!R2_PUBLIC_URL) throw new Error("R2_PUBLIC_URL is not configured");
  await r2["send"](
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return `${R2_PUBLIC_URL}/${key}`;
}

export async function deleteFromR2(key: string) {
  if (!R2_BUCKET) return;
  await r2["send"](new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

// Presigned PUT url for direct browser uploads.
export async function getPresignedUploadUrl(key: string, contentType: string) {
  if (!R2_BUCKET) throw new Error("R2_BUCKET is not configured");
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 600 }
  );
}

import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createR2Client } from "./client";

// Kind-aware like the existing Supabase upload path (app/api/files/sign),
// so this is ready if artwork ever moves here too — but right now only
// audio is actually routed through R2; artwork stays on Supabase.
export type R2FileKind = "artwork" | "audio";

const UPLOAD_URL_EXPIRES_SECONDS = 5 * 60;
const READ_URL_EXPIRES_SECONDS = 60 * 60;

/** Same path convention as app/api/files/sign's Supabase paths, so the two
 * providers stay consistent if one is ever swapped for the other. */
export function r2ObjectKey({
  kind,
  userId,
  albumId,
  trackId,
  ext,
}: {
  kind: R2FileKind;
  userId: string;
  albumId: string;
  trackId?: string;
  ext: string;
}): string {
  if (kind === "artwork") {
    return `${userId}/${albumId}/cover.${ext}`;
  }
  return `${userId}/${albumId}/${trackId}.${ext}`;
}

export async function createR2UploadUrl(key: string, contentType: string): Promise<string> {
  const client = createR2Client();
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: UPLOAD_URL_EXPIRES_SECONDS });
}

/** Objects are private — every read (including right after upload, and
 * every subsequent page load) goes through a fresh signed URL rather than
 * a stored public one, since a permanent URL would either expire in the DB
 * or require making the bucket publicly readable. */
export async function createR2ReadUrl(key: string): Promise<string> {
  const client = createR2Client();
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: READ_URL_EXPIRES_SECONDS });
}

import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createR2Client } from "./client";

// Nothing currently calls the functions in this module. Audio moved to
// local-first verification (lib/localAudio.ts) instead of any remote
// storage, and artwork stays on Supabase Storage (app/api/files/sign,
// app/api/files/attach) rather than moving here. Left in place, unused, as
// ready-to-wire infrastructure in case artwork is ever moved onto R2 — a
// deliberate product decision, not dead code to clean up.
export type R2FileKind = "artwork";

const UPLOAD_URL_EXPIRES_SECONDS = 5 * 60;
const READ_URL_EXPIRES_SECONDS = 60 * 60;

/** Same path convention as app/api/files/sign's Supabase paths, so the two
 * providers stay consistent if one is ever swapped for the other. */
export function r2ObjectKey({
  userId,
  albumId,
  ext,
}: {
  userId: string;
  albumId: string;
  ext: string;
}): string {
  return `${userId}/${albumId}/cover.${ext}`;
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

import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 client, via its S3-compatible API. Always server-side —
 * these are secret credentials, never expose this client to the browser.
 * Mirrors lib/supabase/admin.ts: one factory, no anon/browser counterpart,
 * since presigned URL generation only ever happens server-side.
 */
export function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    // Required for R2: without this the SDK defaults to virtual-hosted-style
    // URLs (bucket.<account>.r2.cloudflarestorage.com), a second-level
    // subdomain R2's TLS cert doesn't cover — causes
    // ERR_SSL_VERSION_OR_CIPHER_MISMATCH in the browser, not an auth error.
    forcePathStyle: true,
  });
}

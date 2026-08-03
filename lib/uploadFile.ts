import { createClient } from "@/lib/supabase/client";

// Keep in sync with app/api/files/sign/route.ts — checked client-side too so
// oversized files fail fast instead of spending a round trip on the sign call.
const ARTWORK_MAX_BYTES = 10 * 1024 * 1024;
// Audio now uploads to R2, not Supabase — no plan-level file size cap to
// stay under, and the upload never passes through the Next.js server
// either way, so this is just a generous sanity ceiling for a single track.
const AUDIO_MAX_BYTES = 500 * 1024 * 1024;

interface UploadCatalogFileParams {
  kind: "artwork" | "audio";
  albumId: string;
  trackId?: string;
  file: File;
}

/**
 * Uploads directly to Supabase Storage via a server-issued signed upload URL,
 * then records the resulting public URL on the album/track row. The file
 * never passes through our Next.js route handlers — necessary for audio
 * files, which routinely exceed Vercel's serverless body-size limit.
 */
export async function uploadCatalogFile({
  kind,
  albumId,
  trackId,
  file,
}: UploadCatalogFileParams): Promise<string> {
  const maxBytes = kind === "artwork" ? ARTWORK_MAX_BYTES : AUDIO_MAX_BYTES;
  if (file.size > maxBytes) {
    throw new Error(`File exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit for ${kind}.`);
  }

  const signRes = await fetch("/api/files/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      album_id: albumId,
      track_id: trackId,
      content_type: file.type,
      size: file.size,
    }),
  });
  const signBody = await signRes.json();
  if (!signRes.ok) {
    throw new Error(signBody.error ?? "Could not prepare the upload.");
  }

  let attachPayload: Record<string, unknown>;

  if (signBody.provider === "r2") {
    // Raw presigned PUT — no SDK involved on this side, just a fetch.
    const putRes = await fetch(signBody.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error(`Upload to storage failed (${putRes.status}).`);
    }
    attachPayload = { kind, album_id: albumId, track_id: trackId, key: signBody.key };
  } else {
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(signBody.bucket)
      .uploadToSignedUrl(signBody.path, signBody.token, file, { contentType: file.type });

    if (uploadError) {
      throw new Error(uploadError.message);
    }
    attachPayload = {
      kind,
      album_id: albumId,
      track_id: trackId,
      bucket: signBody.bucket,
      path: signBody.path,
    };
  }

  const attachRes = await fetch("/api/files/attach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(attachPayload),
  });
  const attachBody = await attachRes.json();
  if (!attachRes.ok) {
    throw new Error(attachBody.error ?? "Could not save the uploaded file.");
  }

  return attachBody.url as string;
}

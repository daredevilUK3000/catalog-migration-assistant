import { createClient } from "@/lib/supabase/client";

// Keep in sync with app/api/files/sign/route.ts — checked client-side too so
// oversized files fail fast instead of spending a round trip on the sign
// call. Artwork only now — audio files stay on the musician's own machine
// (lib/localAudio.ts) and are never uploaded anywhere.
const ARTWORK_MAX_BYTES = 10 * 1024 * 1024;

interface UploadArtworkFileParams {
  albumId: string;
  file: File;
}

/**
 * Uploads directly to Supabase Storage via a server-issued signed upload URL,
 * then records the resulting public URL on the album row. The file never
 * passes through our Next.js route handlers.
 */
export async function uploadArtworkFile({ albumId, file }: UploadArtworkFileParams): Promise<string> {
  if (file.size > ARTWORK_MAX_BYTES) {
    throw new Error(`File exceeds the ${Math.round(ARTWORK_MAX_BYTES / (1024 * 1024))}MB limit for artwork.`);
  }

  const signRes = await fetch("/api/files/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      album_id: albumId,
      content_type: file.type,
      size: file.size,
    }),
  });
  const signBody = await signRes.json();
  if (!signRes.ok) {
    throw new Error(signBody.error ?? "Could not prepare the upload.");
  }

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(signBody.bucket)
    .uploadToSignedUrl(signBody.path, signBody.token, file, { contentType: file.type });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const attachRes = await fetch("/api/files/attach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ album_id: albumId, path: signBody.path }),
  });
  const attachBody = await attachRes.json();
  if (!attachRes.ok) {
    throw new Error(attachBody.error ?? "Could not save the uploaded file.");
  }

  return attachBody.url as string;
}

// Duration and best-effort embedded tag reading for local WAV/FLAC files.
// Everything here reads only small, bounded byte ranges via
// File.slice(...).arrayBuffer() — audio payload bytes are never pulled into
// memory, and nothing here uploads or transmits anything. Used as a
// secondary/tertiary signal by lib/audioMatcher.ts, never a requirement: any
// parse failure or unsupported format quietly returns nulls rather than
// throwing, since this is only ever a confidence booster or sanity check.

export interface AudioFileInfo {
  durationSeconds: number | null;
  embeddedTitle: string | null;
  embeddedTrackNumber: number | null;
}

const NO_INFO: AudioFileInfo = {
  durationSeconds: null,
  embeddedTitle: null,
  embeddedTrackNumber: null,
};

export async function getAudioFileInfo(file: File): Promise<AudioFileInfo> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  try {
    if (ext === "wav") return await readWavInfo(file);
    if (ext === "flac") return await readFlacInfo(file);
  } catch {
    return NO_INFO;
  }
  return NO_INFO;
}

function readAsciiTag(dv: DataView, offset: number, length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) s += String.fromCharCode(dv.getUint8(offset + i));
  return s;
}

function decodeUtf8(dv: DataView, offset: number, length: number): string {
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset + offset, length);
  return new TextDecoder("utf-8").decode(bytes);
}

// ---------------------------------------------------------------------------
// WAV — RIFF chunk walk. Chunks are word-aligned (odd sizes get a pad byte).
// ---------------------------------------------------------------------------

const WAV_PREFIX_START = 64 * 1024;
const WAV_PREFIX_CAP = 8 * 1024 * 1024;

type WavWalkResult =
  | { status: "invalid" }
  | { status: "need-more" }
  | { status: "ok"; info: AudioFileInfo };

function walkWav(buf: ArrayBuffer): WavWalkResult {
  const dv = new DataView(buf);
  if (buf.byteLength < 12) return { status: "need-more" };
  if (readAsciiTag(dv, 0, 4) !== "RIFF" || readAsciiTag(dv, 8, 4) !== "WAVE") {
    return { status: "invalid" };
  }

  let offset = 12;
  let byteRate: number | null = null;
  let dataSize: number | null = null;
  let title: string | null = null;

  while (offset + 8 <= buf.byteLength) {
    const chunkId = readAsciiTag(dv, offset, 4);
    const chunkSize = dv.getUint32(offset + 4, true);
    const payloadStart = offset + 8;

    if (chunkId === "fmt " && payloadStart + 16 <= buf.byteLength) {
      byteRate = dv.getUint32(payloadStart + 8, true);
    } else if (chunkId === "data") {
      dataSize = chunkSize;
    } else if (chunkId === "LIST" && !title && payloadStart + chunkSize <= buf.byteLength) {
      title = findInamTag(dv, payloadStart, chunkSize);
    }

    offset = payloadStart + chunkSize + (chunkSize % 2);
  }

  if (dataSize !== null) {
    const durationSeconds = byteRate && byteRate > 0 ? dataSize / byteRate : null;
    return { status: "ok", info: { durationSeconds, embeddedTitle: title, embeddedTrackNumber: null } };
  }
  return { status: "need-more" };
}

function findInamTag(dv: DataView, start: number, length: number): string | null {
  if (length < 4 || readAsciiTag(dv, start, 4) !== "INFO") return null;
  let offset = start + 4;
  const end = start + length;
  while (offset + 8 <= end) {
    const id = readAsciiTag(dv, offset, 4);
    const size = dv.getUint32(offset + 4, true);
    const payloadStart = offset + 8;
    if (id === "INAM" && payloadStart + size <= end) {
      return decodeUtf8(dv, payloadStart, size).replace(/\0+$/, "").trim() || null;
    }
    offset = payloadStart + size + (size % 2);
  }
  return null;
}

/** Grows the read window (doubling, capped) until the 'data' chunk header is
 * found or we run out of file — covers the rare WAV with unusually large
 * metadata chunks before 'data' without ever reading the audio payload. */
async function readWavInfo(file: File): Promise<AudioFileInfo> {
  let prefixSize = Math.min(WAV_PREFIX_START, file.size);
  for (;;) {
    const isFinal = prefixSize >= file.size;
    const buf = await file.slice(0, prefixSize).arrayBuffer();
    const result = walkWav(buf);
    if (result.status === "ok") return result.info;
    if (result.status === "invalid") return NO_INFO;
    if (isFinal || prefixSize >= WAV_PREFIX_CAP) return NO_INFO;
    prefixSize = Math.min(prefixSize * 2, WAV_PREFIX_CAP, file.size);
  }
}

// ---------------------------------------------------------------------------
// FLAC — metadata block walk. Only STREAMINFO and VORBIS_COMMENT payloads are
// ever read; other blocks (e.g. PICTURE, which can be several MB of cover
// art) are skipped by offset alone.
// ---------------------------------------------------------------------------

const FLAC_STREAMINFO_TYPE = 0;
const FLAC_VORBIS_COMMENT_TYPE = 4;
const FLAC_MAX_BLOCKS = 256; // guards against a malformed file with no last-block flag

async function readFlacInfo(file: File): Promise<AudioFileInfo> {
  const magicBuf = await file.slice(0, 4).arrayBuffer();
  if (magicBuf.byteLength < 4 || readAsciiTag(new DataView(magicBuf), 0, 4) !== "fLaC") {
    return NO_INFO;
  }

  let offset = 4;
  let durationSeconds: number | null = null;
  let embeddedTitle: string | null = null;
  let embeddedTrackNumber: number | null = null;

  for (let guard = 0; guard < FLAC_MAX_BLOCKS && offset + 4 <= file.size; guard++) {
    const headerBuf = await file.slice(offset, offset + 4).arrayBuffer();
    const headerDv = new DataView(headerBuf);
    const headerByte = headerDv.getUint8(0);
    const isLast = (headerByte & 0x80) !== 0;
    const blockType = headerByte & 0x7f;
    const blockLength =
      (headerDv.getUint8(1) << 16) | (headerDv.getUint8(2) << 8) | headerDv.getUint8(3);
    const payloadStart = offset + 4;

    if (blockType === FLAC_STREAMINFO_TYPE && blockLength >= 18) {
      const buf = await file.slice(payloadStart, payloadStart + blockLength).arrayBuffer();
      durationSeconds = parseStreamInfo(new DataView(buf));
    } else if (blockType === FLAC_VORBIS_COMMENT_TYPE) {
      const buf = await file.slice(payloadStart, payloadStart + blockLength).arrayBuffer();
      const parsed = parseVorbisComment(new DataView(buf));
      embeddedTitle = parsed.title;
      embeddedTrackNumber = parsed.trackNumber;
    }

    offset = payloadStart + blockLength;
    if (isLast) break;
  }

  return { durationSeconds, embeddedTitle, embeddedTrackNumber };
}

/** STREAMINFO is a fixed 34-byte block. Bytes 10-17 are bit-packed (MSB
 * first): 20 bits sample rate, 3 bits channels-1, 5 bits bits-per-sample-1,
 * 36 bits total samples — BigInt is needed since that's a 64-bit span. */
function parseStreamInfo(dv: DataView): number | null {
  if (dv.byteLength < 18) return null;
  let bits = BigInt(0);
  for (let i = 10; i < 18; i++) bits = (bits << BigInt(8)) | BigInt(dv.getUint8(i));
  const totalSamplesMask = (BigInt(1) << BigInt(36)) - BigInt(1);
  const sampleRateMask = (BigInt(1) << BigInt(20)) - BigInt(1);
  const totalSamples = bits & totalSamplesMask;
  const sampleRate = Number((bits >> BigInt(44)) & sampleRateMask);
  if (sampleRate <= 0) return null;
  return Number(totalSamples) / sampleRate;
}

/** FLAC's VORBIS_COMMENT payload uses little-endian lengths (unlike the
 * big-endian FLAC block header above) and, unlike Ogg Vorbis, has no
 * trailing framing bit. */
function parseVorbisComment(dv: DataView): { title: string | null; trackNumber: number | null } {
  let title: string | null = null;
  let trackNumber: number | null = null;
  if (dv.byteLength < 4) return { title, trackNumber };

  let offset = 0;
  const vendorLength = dv.getUint32(offset, true);
  offset += 4 + vendorLength;
  if (offset + 4 > dv.byteLength) return { title, trackNumber };

  const commentCount = dv.getUint32(offset, true);
  offset += 4;

  for (let i = 0; i < commentCount && offset + 4 <= dv.byteLength; i++) {
    const len = dv.getUint32(offset, true);
    offset += 4;
    if (offset + len > dv.byteLength) break;
    const raw = decodeUtf8(dv, offset, len);
    offset += len;

    const eq = raw.indexOf("=");
    if (eq === -1) continue;
    const key = raw.slice(0, eq).toUpperCase();
    const value = raw.slice(eq + 1).trim();

    if (key === "TITLE" && !title) title = value || null;
    if (key === "TRACKNUMBER" && trackNumber === null) {
      const n = parseInt(value, 10);
      if (!Number.isNaN(n)) trackNumber = n;
    }
  }

  return { title, trackNumber };
}

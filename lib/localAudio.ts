// Local-first audio verification via the File System Access API
// (Chromium-only — Chrome, Edge). Nothing in this module ever reads a
// file's bytes anywhere but the browser, and nothing here uploads
// anything: a successful match only ever yields a filename/relative path
// string for tracks.audio_file_url. Safari/Firefox have no equivalent API
// and fall back to manual self-attestation in AttachFilesForm instead.

export const AUDIO_EXT_FORMAT: Record<string, string> = {
  mp3: "MP3",
  wav: "WAV",
  flac: "FLAC",
  m4a: "M4A",
  aac: "AAC",
  ogg: "OGG",
};

export interface LocalAudioFile {
  /** Path from the picked root folder, e.g. "Disc 1/02 Song.wav" — this is
   * exactly what gets stored in tracks.audio_file_url once verified. */
  relativePath: string;
  name: string;
  size: number;
  format: string;
}

export function isLocalFileVerificationSupported(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

function formatForName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXT_FORMAT[ext] ?? "Unknown";
}

export async function pickAudioFolder(): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) {
    throw new Error("Local file verification isn't supported in this browser.");
  }
  return window.showDirectoryPicker({ id: "catalog-migration-audio", mode: "read" });
}

/** Walks the picked folder one level deep — flat album folders match
 * directly, and a single level of subfolders covers picking one root
 * folder once globally with a per-album subfolder inside it. */
export async function listAudioFiles(root: FileSystemDirectoryHandle): Promise<LocalAudioFile[]> {
  const files: LocalAudioFile[] = [];

  async function readLevel(dir: FileSystemDirectoryHandle, prefix: string, depth: number) {
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === "file") {
        const ext = name.split(".").pop()?.toLowerCase() ?? "";
        if (!(ext in AUDIO_EXT_FORMAT)) continue;
        const file = await (handle as FileSystemFileHandle).getFile();
        files.push({
          relativePath: prefix ? `${prefix}/${name}` : name,
          name,
          size: file.size,
          format: formatForName(name),
        });
      } else if (depth < 1) {
        await readLevel(handle as FileSystemDirectoryHandle, prefix ? `${prefix}/${name}` : name, depth + 1);
      }
    }
  }

  await readLevel(root, "", 0);
  return files;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

export {};

// The installed TypeScript lib.dom.d.ts has FileSystemDirectoryHandle and
// FileSystemFileHandle (the File System Access API's handle types) but is
// missing showDirectoryPicker and directory iteration — both shipped in
// Chromium for years. Filled in here rather than pulling in a types
// package for two declarations.
declare global {
  interface FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  }

  interface DirectoryPickerOptions {
    id?: string;
    mode?: "read" | "readwrite";
  }

  interface Window {
    showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  }
}

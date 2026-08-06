// Shared between ImportForm (first file) and ConfirmAlbumForm (the "add
// another file to this import" step) — both drive the same three
// extraction endpoints off the same source-type selector.
export type UploadMethod = "screenshot" | "pdf" | "csv";

export const METHOD_LABEL: Record<UploadMethod, string> = {
  screenshot: "Screenshot",
  pdf: "PDF",
  csv: "CSV / Excel",
};

export const ACCEPT_BY_METHOD: Record<UploadMethod, string> = {
  screenshot: "image/jpeg,image/png,image/gif,image/webp",
  pdf: "application/pdf",
  csv: ".csv,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const ENDPOINT_BY_METHOD: Record<UploadMethod, string> = {
  screenshot: "/api/import/screenshot",
  pdf: "/api/import/pdf",
  csv: "/api/import/csv",
};

export const FIELD_NAME_BY_METHOD: Record<UploadMethod, string> = {
  screenshot: "image",
  pdf: "file",
  csv: "file",
};

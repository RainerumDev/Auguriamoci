/** Google Drive API v3 connector (read-only). */
import { googleGet, googleGetBlob } from "./api";

/** Per-file download cap: signage media beyond this is skipped (PRD: "blob leggeri"). */
export const MAX_MEDIA_BYTES = 150 * 1024 * 1024;

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  /** Bytes; Google-native files (Docs/Slides) have none. */
  size?: number;
  modifiedTime: string;
  /** Link used to build the <iframe> embed for Docs/Slides. */
  webViewLink?: string;
  /** True when the file exceeds MAX_MEDIA_BYTES and was not downloaded. */
  tooLarge?: boolean;
}

export interface DrivePayload {
  files: DriveFileMeta[];
}

/**
 * Accepts a folder URL or a bare folder ID.
 * https://drive.google.com/drive/folders/<ID>?usp=... -> <ID>
 */
export function extractFolderId(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = /\/folders\/([a-zA-Z0-9_-]+)/.exec(trimmed);
  if (fromUrl) return fromUrl[1];
  const fromQuery = /[?&]id=([a-zA-Z0-9_-]+)/.exec(trimmed);
  if (fromQuery) return fromQuery[1];
  return /^[a-zA-Z0-9_-]{10,}$/.test(trimmed) ? trimmed : null;
}

/**
 * Accepts a Drive FILE url or bare ID.
 * https://drive.google.com/file/d/<ID>/view -> <ID>
 */
export function extractDriveFileId(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = /\/(?:file\/)?d\/([a-zA-Z0-9_-]+)/.exec(trimmed);
  if (fromUrl) return fromUrl[1];
  const fromQuery = /[?&]id=([a-zA-Z0-9_-]+)/.exec(trimmed);
  if (fromQuery) return fromQuery[1];
  return /^[a-zA-Z0-9_-]{10,}$/.test(trimmed) ? trimmed : null;
}

/** Non-trashed files inside a folder (single page, up to 1000 entries). */
export async function listFolderFiles(
  folderId: string,
  accessToken: string,
): Promise<DrivePayload> {
  const params = new URLSearchParams({
    q: `'${folderId.replaceAll("'", "\\'")}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,size,modifiedTime,webViewLink)",
    pageSize: "1000",
    orderBy: "name",
  });
  const data = await googleGet<{
    files?: (Omit<DriveFileMeta, "size"> & { size?: string })[];
  }>(`https://www.googleapis.com/drive/v3/files?${params}`, accessToken);

  const files = (data.files ?? []).map((f) => ({
    ...f,
    size: f.size ? Number(f.size) : undefined,
  }));
  return { files };
}

/** True for media types we download and store as blobs in IndexedDB. */
export function isDownloadableMedia(file: DriveFileMeta): boolean {
  return (
    (file.mimeType.startsWith("image/") ||
      file.mimeType.startsWith("video/")) &&
    (file.size ?? 0) <= MAX_MEDIA_BYTES
  );
}

/** True for Google-native files rendered via <iframe> (online only). */
export function isEmbeddable(file: DriveFileMeta): boolean {
  return (
    file.mimeType === "application/vnd.google-apps.presentation" ||
    file.mimeType === "application/vnd.google-apps.document"
  );
}

export async function downloadFileBlob(
  fileId: string,
  accessToken: string,
): Promise<Blob> {
  return googleGetBlob(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    accessToken,
  );
}

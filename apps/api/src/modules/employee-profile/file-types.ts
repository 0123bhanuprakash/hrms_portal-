// ============================================================
// Upload type checks by content (magic bytes), not by the client's
// filename or Content-Type. The stored extension comes from here.
// ============================================================

export interface DetectedType {
  ext: string;
  mime: string;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function detectFileType(buf: Buffer, declaredMime?: string): DetectedType | null {
  const at = (offset: number, bytes: number[]) => bytes.every((b, i) => buf[offset + i] === b);
  if (at(0, [0xff, 0xd8, 0xff])) return { ext: 'jpg', mime: 'image/jpeg' };
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: 'png', mime: 'image/png' };
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return { ext: 'webp', mime: 'image/webp' };
  if (at(0, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { ext: 'pdf', mime: 'application/pdf' };
  // .docx is a zip; trust the declared type only when the content really is a zip
  if (at(0, [0x50, 0x4b, 0x03, 0x04]) && declaredMime === DOCX_MIME) return { ext: 'docx', mime: DOCX_MIME };
  return null;
}

export const IMAGE_TYPES = new Set(['jpg', 'png', 'webp']);
export const DOCUMENT_TYPES = new Set(['pdf', 'jpg', 'png', 'webp', 'docx']);

// ============================================================
// StorageService — injection token + contract for file storage.
//
// Implementations (selected by STORAGE_DRIVER in StorageModule):
//   local → LocalStorageService  (disk, served by the API at /uploads)
//   s3    → MinioService         (MinIO / AWS S3 / Supabase Storage)
// ============================================================

export abstract class StorageService {
  /**
   * Stores a file and returns the URL to persist (e.g. CompanyBranding.logoUrl).
   * `key` is a relative path such as `<companyId>/branding/logo.png`.
   */
  abstract upload(key: string, body: Buffer, contentType: string): Promise<string>;
}

/** Keys must be simple relative paths: no `..`, no leading slash, safe characters only. */
export function assertSafeStorageKey(key: string): void {
  if (!/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.[a-z0-9]+$/.test(key)) {
    throw new Error(`Invalid storage key '${key}'`);
  }
}

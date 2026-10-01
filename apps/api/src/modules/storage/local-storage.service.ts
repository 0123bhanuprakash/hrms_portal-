import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageService, assertSafeStorageKey } from './storage.service';

// ============================================================
// LocalStorageService — STORAGE_DRIVER=local (default)
//
// Saves files under UPLOADS_DIR (default: apps/api/uploads) and
// returns a URL served by the API's static /uploads route (main.ts).
// ============================================================

@Injectable()
export class LocalStorageService extends StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly rootDir: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    super();
    this.rootDir = path.resolve(config.get<string>('storage.uploadsDir') ?? 'uploads');
    const apiUrl = config.get<string>('apiUrl') ?? 'http://localhost:4000';
    this.publicBaseUrl = `${apiUrl.replace(/\/+$/, '')}/uploads`;
    this.logger.log(`📦 Storage: local disk (${this.rootDir})`);
  }

  async upload(key: string, body: Buffer, _contentType: string): Promise<string> {
    assertSafeStorageKey(key);

    const filePath = path.resolve(this.rootDir, key);
    if (!filePath.startsWith(this.rootDir + path.sep)) {
      throw new Error(`Storage key escapes uploads directory: '${key}'`);
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);

    // Cache-buster: the same key (e.g. logo.png) is overwritten on re-upload
    return `${this.publicBaseUrl}/${key}?v=${Date.now()}`;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, promises as fs, type ReadStream } from 'fs';
import * as path from 'path';
import { assertSafeStorageKey } from '../storage/storage.service';

// ============================================================
// Private file storage (employee documents).
// Files live under PRIVATE_FILES_DIR on the API server and are NEVER
// served statically — only streamed by an authorised download route.
// Swap for S3 / Supabase Storage (private bucket) when production
// storage is decided; callers only use save / open / remove.
// ============================================================

@Injectable()
export class PrivateFilesService {
  private readonly logger = new Logger(PrivateFilesService.name);
  private readonly rootDir: string;

  constructor(config: ConfigService) {
    this.rootDir = path.resolve(config.get<string>('storage.privateDir') ?? 'private-files');
    this.logger.log(`🔒 Private files: local disk (${this.rootDir})`);
  }

  private resolve(key: string): string {
    assertSafeStorageKey(key);
    const filePath = path.resolve(this.rootDir, key);
    if (!filePath.startsWith(this.rootDir + path.sep)) throw new Error(`Storage key escapes private directory: '${key}'`);
    return filePath;
  }

  async save(key: string, body: Buffer): Promise<void> {
    const filePath = this.resolve(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body, { flag: 'wx' });
  }

  async open(key: string): Promise<ReadStream> {
    const filePath = this.resolve(key);
    await fs.access(filePath);
    return createReadStream(filePath);
  }

  async remove(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}

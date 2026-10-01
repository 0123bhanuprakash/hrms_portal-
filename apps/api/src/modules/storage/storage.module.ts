import { DynamicModule, Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { MinioService } from './minio.service';

@Global()
@Module({})
export class StorageModule {
  /** Binds StorageService to local disk (default) or MinIO/S3 (STORAGE_DRIVER=s3). */
  static register(): DynamicModule {
    const driver = process.env['STORAGE_DRIVER'] === 's3' ? MinioService : LocalStorageService;
    return {
      module: StorageModule,
      providers: [{ provide: StorageService, useClass: driver }],
      exports: [StorageService],
    };
  }
}

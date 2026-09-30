import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// ============================================================
// PrismaModule — @Global() so PrismaService is available
// everywhere without explicit imports in each feature module.
// ============================================================

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

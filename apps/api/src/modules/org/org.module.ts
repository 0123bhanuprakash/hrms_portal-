import { Module } from '@nestjs/common';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';

/** Organisation structure: org levels, org chart, reporting lines. */
@Module({
  controllers: [OrgController],
  providers: [OrgService],
})
export class OrgModule {}

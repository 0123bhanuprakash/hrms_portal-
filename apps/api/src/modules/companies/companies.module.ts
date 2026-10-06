import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { ThemesModule } from '../themes/themes.module';
import { SeasonsModule } from '../seasons/seasons.module';

@Module({
  imports: [PrismaModule, EmailModule, ThemesModule, SeasonsModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}

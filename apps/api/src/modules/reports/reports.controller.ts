import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { ReportsService } from './reports.service';
import { MonthQueryDto, RangeQueryDto } from './dto';

const file = (body: string, name: string) => new StreamableFile(Buffer.from(body, 'utf8'), { type: 'text/csv; charset=utf-8', disposition: `attachment; filename="${name}"` });

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @Get('people')
  people(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.reports.people(ctx.companyId!, access);
  }

  @RequireFeature('insights.reports')
  @RequirePermission('report.export')
  @Audit('report:export:people', 'report')
  @Get('people/export')
  async peopleCsv(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext): Promise<StreamableFile> {
    return file(await this.reports.peopleCsv(ctx.companyId!, access), `employees-${await this.reports.todayKey(ctx.companyId!)}.csv`);
  }

  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @Get('attendance')
  attendance(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: MonthQueryDto) {
    return this.reports.attendance(ctx.companyId!, access, q);
  }

  /** PMO (project.manage) sees everyone; managers with report.view see their scope. */
  @RequireFeature('work.projects')
  @Get('utilisation')
  utilisation(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: RangeQueryDto) {
    return this.reports.utilisation(ctx.companyId!, access, q);
  }

  @RequireFeature('work.projects')
  @Audit('report:export:utilisation', 'report')
  @Get('utilisation/export')
  async utilisationCsv(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: RangeQueryDto): Promise<StreamableFile> {
    const r = await this.reports.utilisationCsv(ctx.companyId!, access, q);
    return file(r.body, r.name);
  }
}

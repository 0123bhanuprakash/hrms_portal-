import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { ProfileService } from './profile.service';
import { DocumentsService, DOCUMENT_MAX_BYTES } from './documents.service';
import { UpdateBankDto, UpdatePersonalDto, UpdateStatutoryDto, UploadDocumentDto } from './dto';
import { Live } from '../realtime/live.decorator';

// Profile sub-resources of an employee. The permission decorator is the
// minimum to call the route; services check the permission's SCOPE
// against this particular employee (out of reach → 404).

@RequireFeature('people.directory')
@Live('people', 'company')
@Controller('employees/:id')
export class EmployeeProfileController {
  constructor(private readonly profile: ProfileService) {}

  @RequirePermission('employee.view_private')
  @Get('private')
  get(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.profile.getPrivate(ctx.companyId!, id, access);
  }

  /** Full PAN + account number. Audited; the values themselves are redacted from the log. */
  @RequirePermission('employee.view_private')
  @Audit('employee:private:reveal', 'employee')
  @Post('private/reveal')
  @HttpCode(HttpStatus.OK)
  reveal(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.profile.reveal(ctx.companyId!, id, access);
  }

  @RequirePermission('employee.edit_private')
  @Audit('employee:personal:update', 'employee')
  @Put('personal')
  personal(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePersonalDto) {
    return this.profile.updatePersonal(ctx.companyId!, id, dto, access);
  }

  @RequirePermission('employee.edit_private')
  @Audit('employee:bank:update', 'employee')
  @Put('bank')
  bank(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBankDto) {
    return this.profile.updateBank(ctx.companyId!, id, dto, access);
  }

  @RequirePermission('employee.edit_private')
  @Audit('employee:statutory:update', 'employee')
  @Put('statutory')
  statutory(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStatutoryDto) {
    return this.profile.updateStatutory(ctx.companyId!, id, dto, access);
  }

  @RequirePermission('employee.edit')
  @Audit('employee:avatar:update', 'employee')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  @Post('avatar')
  avatar(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profile.uploadAvatar(ctx.companyId!, id, file, access);
  }

  @RequirePermission('employee.edit')
  @Audit('employee:avatar:remove', 'employee')
  @Delete('avatar')
  removeAvatar(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.profile.removeAvatar(ctx.companyId!, id, access);
  }
}

@RequireFeature('people.documents')
@Controller('employees/:id/documents')
export class EmployeeDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @RequirePermission('document.view')
  @Get()
  list(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.list(ctx.companyId!, id, access);
  }

  @RequirePermission('document.upload')
  @Audit('employee:document:upload', 'employee_document')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1 } }))
  @Post()
  upload(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documents.upload(ctx.companyId!, id, file, dto, access);
  }

  @RequirePermission('document.view')
  @Get(':documentId/download')
  async download(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: Request,
  ): Promise<StreamableFile> {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
    const { stream, doc } = await this.documents.open(ctx.companyId!, id, documentId, access, { ip, userAgent: req.headers['user-agent'] });
    return new StreamableFile(stream, {
      type: doc.mimeType,
      length: doc.sizeBytes,
      disposition: `attachment; filename="${doc.fileName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
    });
  }

  @RequirePermission('document.view')
  @Audit('employee:document:delete', 'employee_document')
  @Delete(':documentId')
  remove(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documents.remove(ctx.companyId!, id, documentId, access);
  }
}

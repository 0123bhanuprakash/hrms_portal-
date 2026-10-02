import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AccessContext } from '../access/access.types';
import { PrivateFilesService } from './private-files.service';
import { ProfileService } from './profile.service';
import { detectFileType, DOCUMENT_TYPES } from './file-types';
import type { UploadDocumentDto } from './dto';

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENTS_PER_EMPLOYEE = 100;

/**
 * Employee documents on private storage.
 *   • document.view   → list + download (scope)
 *   • document.upload → add (scope; "own" lets employees upload their own)
 *   • document.delete → remove (scope) — people may also remove what they uploaded to their own profile
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly files: PrivateFilesService,
    private readonly profile: ProfileService,
  ) {}

  async list(companyId: string, employeeId: string, access: AccessContext) {
    await this.access.assertEmployeeInScope(access, 'document.view', companyId, employeeId);
    const [docs, canUpload, canDeleteAny] = await Promise.all([
      this.prisma.employeeDocument.findMany({
        where: { companyId, employeeId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          category: true,
          name: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          uploadedById: true,
          uploadedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.profile.reaches(access, 'document.upload', companyId, employeeId),
      this.profile.reaches(access, 'document.delete', companyId, employeeId),
    ]);
    const isSelf = access.employee?.id === employeeId;
    return {
      canUpload,
      documents: docs.map(({ uploadedById, ...d }) => ({
        ...d,
        canDelete: canDeleteAny || (isSelf && uploadedById === access.userId),
      })),
    };
  }

  async upload(companyId: string, employeeId: string, file: Express.Multer.File | undefined, dto: UploadDocumentDto, access: AccessContext) {
    await this.access.assertEmployeeInScope(access, 'document.upload', companyId, employeeId);
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > DOCUMENT_MAX_BYTES) throw new BadRequestException('File must be 10 MB or smaller');
    const type = detectFileType(file.buffer, file.mimetype);
    if (!type || !DOCUMENT_TYPES.has(type.ext)) throw new BadRequestException('Allowed files: PDF, JPG, PNG, WebP or Word (.docx)');
    const count = await this.prisma.employeeDocument.count({ where: { companyId, employeeId } });
    if (count >= MAX_DOCUMENTS_PER_EMPLOYEE) throw new BadRequestException(`An employee can have at most ${MAX_DOCUMENTS_PER_EMPLOYEE} documents`);

    const id = randomUUID();
    const storageKey = `${companyId}/documents/${employeeId}/${id}.${type.ext}`;
    const fileName = this.safeFileName(file.originalname, type.ext);
    await this.files.save(storageKey, file.buffer);
    try {
      return await this.prisma.employeeDocument.create({
        data: {
          id,
          companyId,
          employeeId,
          category: dto.category,
          name: dto.name || fileName.replace(/\.[^.]+$/, ''),
          fileName,
          mimeType: type.mime,
          sizeBytes: file.size,
          storageKey,
          uploadedById: access.userId,
        },
        select: { id: true, category: true, name: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
      });
    } catch (err) {
      await this.files.remove(storageKey);
      throw err;
    }
  }

  /** Opens the file for streaming and records who downloaded what. */
  async open(companyId: string, employeeId: string, documentId: string, access: AccessContext, meta: { ip?: string; userAgent?: string }) {
    await this.access.assertEmployeeInScope(access, 'document.view', companyId, employeeId);
    const doc = await this.prisma.employeeDocument.findFirst({ where: { id: documentId, companyId, employeeId } });
    if (!doc) throw new NotFoundException('Document not found');
    const stream = await this.files.open(doc.storageKey).catch(() => {
      this.logger.error(`Document ${doc.id} is missing from private storage`);
      throw new NotFoundException('The file is no longer available');
    });
    await this.prisma.auditLog
      .create({
        data: {
          action: 'employee:document:download',
          resourceType: 'employee_document',
          resourceId: doc.id,
          afterState: { employeeId, name: doc.name, category: doc.category },
          userId: access.userId,
          companyId,
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        },
      })
      .catch((err: unknown) => this.logger.error('Failed to audit document download', err));
    return { stream, doc };
  }

  async remove(companyId: string, employeeId: string, documentId: string, access: AccessContext) {
    await this.access.assertEmployeeInScope(access, 'document.view', companyId, employeeId);
    const doc = await this.prisma.employeeDocument.findFirst({ where: { id: documentId, companyId, employeeId } });
    if (!doc) throw new NotFoundException('Document not found');
    const ownUpload = access.employee?.id === employeeId && doc.uploadedById === access.userId;
    if (!ownUpload && !(await this.profile.reaches(access, 'document.delete', companyId, employeeId))) {
      throw new ForbiddenException('You do not have permission to perform this action. Required: document.delete');
    }
    await this.prisma.employeeDocument.delete({ where: { id: doc.id } });
    await this.files.remove(doc.storageKey).catch((err: unknown) => this.logger.error(`Could not delete file for document ${doc.id}`, err));
    return { id: doc.id, name: doc.name, category: doc.category };
  }

  /** Keeps a readable name for downloads; strips paths and odd characters. */
  private safeFileName(original: string | undefined, ext: string): string {
    const base = (original ?? 'document').split(/[\\/]/).pop()!.replace(/\.[^.]*$/, '');
    const clean = base.normalize('NFKD').replace(/[^\w\- ().]+/g, '').trim().slice(0, 80) || 'document';
    return `${clean}.${ext}`;
  }
}

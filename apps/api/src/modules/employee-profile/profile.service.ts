import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { StorageService } from '../storage/storage.service';
import type { AccessContext } from '../access/access.types';
import { PiiCryptoService, maskTail } from './pii-crypto.service';
import { detectFileType, IMAGE_TYPES } from './file-types';
import type { UpdateBankDto, UpdatePersonalDto, UpdateStatutoryDto } from './dto';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Private profile data: personal details, bank account and government IDs.
 *   • employee.view_private  → read (masked) and reveal (audited)
 *   • employee.edit_private  → change
 * Both follow the permission's scope — "own" for self-service, "company" for HR.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly crypto: PiiCryptoService,
    private readonly storage: StorageService,
  ) {}

  /** True when `permission` (with the caller's scope) reaches this employee. */
  async reaches(access: AccessContext, permission: string, companyId: string, employeeId: string): Promise<boolean> {
    const scope = this.access.employeeScope(access, permission);
    if (!scope) return false;
    return (await this.prisma.employee.count({ where: { AND: [{ id: employeeId, companyId }, scope] } })) > 0;
  }

  // ─── Read ──────────────────────────────────────────────────

  async getPrivate(companyId: string, employeeId: string, access: AccessContext) {
    await this.access.assertEmployeeInScope(access, 'employee.view_private', companyId, employeeId);
    const employee = await this.prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      select: {
        id: true,
        phone: true,
        gender: true,
        dateOfBirth: true,
        personal: true,
        bankDetails: true,
        statutoryInfo: true,
      },
    });
    return {
      id: employee.id,
      phone: employee.phone,
      gender: employee.gender,
      dateOfBirth: employee.dateOfBirth,
      personal: employee.personal && {
        personalEmail: employee.personal.personalEmail,
        bloodGroup: employee.personal.bloodGroup,
        maritalStatus: employee.personal.maritalStatus,
        currentAddress: employee.personal.currentAddress,
        permanentAddress: employee.personal.permanentAddress,
        emergencyContactName: employee.personal.emergencyContactName,
        emergencyContactRelation: employee.personal.emergencyContactRelation,
        emergencyContactPhone: employee.personal.emergencyContactPhone,
        updatedAt: employee.personal.updatedAt,
      },
      bank: this.maskedBank(employee.bankDetails),
      statutory: this.maskedStatutory(employee.statutoryInfo),
      canEdit: await this.reaches(access, 'employee.edit_private', companyId, employeeId),
    };
  }

  /** Full PAN and account number — audited by the controller (values are redacted in the log). */
  async reveal(companyId: string, employeeId: string, access: AccessContext) {
    await this.access.assertEmployeeInScope(access, 'employee.view_private', companyId, employeeId);
    const [bank, statutory] = await Promise.all([
      this.prisma.employeeBankDetails.findUnique({ where: { employeeId }, select: { accountNumber: true } }),
      this.prisma.employeeStatutory.findUnique({ where: { employeeId }, select: { pan: true } }),
    ]);
    return {
      id: employeeId,
      accountNumber: bank ? this.crypto.decrypt(bank.accountNumber) : null,
      pan: statutory?.pan ? this.crypto.decrypt(statutory.pan) : null,
    };
  }

  // ─── Write ─────────────────────────────────────────────────

  async updatePersonal(companyId: string, employeeId: string, dto: UpdatePersonalDto, access: AccessContext) {
    await this.access.assertEmployeeInScope(access, 'employee.edit_private', companyId, employeeId);
    if (dto.dateOfBirth && new Date(dto.dateOfBirth) > new Date()) throw new BadRequestException('Date of birth cannot be in the future');

    const personal: Prisma.EmployeePersonalUpdateInput = {};
    for (const key of ['personalEmail', 'bloodGroup', 'maritalStatus', 'emergencyContactName', 'emergencyContactRelation', 'emergencyContactPhone'] as const) {
      if (dto[key] !== undefined) personal[key] = dto[key];
    }
    for (const key of ['currentAddress', 'permanentAddress'] as const) {
      if (dto[key] !== undefined) personal[key] = this.address(dto[key]);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.gender !== undefined && { gender: dto.gender }),
          ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }),
        },
      });
      if (Object.keys(personal).length) {
        await tx.employeePersonal.upsert({
          where: { employeeId },
          update: personal,
          create: { ...(personal as Prisma.EmployeePersonalUncheckedCreateInput), companyId, employeeId },
        });
      }
    });
    return { id: employeeId, updated: Object.keys(dto) };
  }

  async updateBank(companyId: string, employeeId: string, dto: UpdateBankDto, access: AccessContext) {
    await this.access.assertEmployeeInScope(access, 'employee.edit_private', companyId, employeeId);
    const data = {
      accountHolderName: dto.accountHolderName,
      accountNumber: this.crypto.encrypt(dto.accountNumber),
      accountLast4: dto.accountNumber.slice(-4),
      ifscCode: dto.ifscCode,
      bankName: dto.bankName,
      branchName: dto.branchName ?? '',
    };
    const bank = await this.prisma.employeeBankDetails.upsert({
      where: { employeeId },
      update: data,
      create: { ...data, companyId, employeeId },
    });
    return { id: employeeId, bank: this.maskedBank(bank) };
  }

  async updateStatutory(companyId: string, employeeId: string, dto: UpdateStatutoryDto, access: AccessContext) {
    await this.access.assertEmployeeInScope(access, 'employee.edit_private', companyId, employeeId);
    const data: Prisma.EmployeeStatutoryUncheckedUpdateInput = {
      ...(dto.pan !== undefined && { pan: dto.pan ? this.crypto.encrypt(dto.pan) : null }),
      // Never store the full Aadhaar number
      ...(dto.aadhaar !== undefined && { aadhaarLast4: dto.aadhaar ? dto.aadhaar.slice(-4) : null }),
      ...(dto.uan !== undefined && { uan: dto.uan }),
      ...(dto.esicNumber !== undefined && { esicNumber: dto.esicNumber }),
      ...(dto.pfAccountNo !== undefined && { pfAccountNo: dto.pfAccountNo }),
      ...(dto.taxRegime !== undefined && { taxRegime: dto.taxRegime }),
    };
    const statutory = await this.prisma.employeeStatutory.upsert({
      where: { employeeId },
      update: data,
      create: { ...(data as Prisma.EmployeeStatutoryUncheckedCreateInput), companyId, employeeId },
    });
    return { id: employeeId, statutory: this.maskedStatutory(statutory) };
  }

  // ─── Photo ─────────────────────────────────────────────────

  async uploadAvatar(companyId: string, employeeId: string, file: Express.Multer.File | undefined, access: AccessContext) {
    await this.access.assertEmployeeInScope(access, 'employee.edit', companyId, employeeId);
    if (!file) throw new BadRequestException('No photo provided');
    if (file.size > AVATAR_MAX_BYTES) throw new BadRequestException('Photo must be 2 MB or smaller');
    const type = detectFileType(file.buffer);
    if (!type || !IMAGE_TYPES.has(type.ext)) throw new BadRequestException('Photo must be a JPG, PNG or WebP image');

    // Random name: the public URL can't be guessed from the employee id
    const key = `${companyId}/avatars/${employeeId}-${randomBytes(8).toString('hex')}.${type.ext}`;
    const avatarUrl = await this.storage.upload(key, file.buffer, type.mime);
    return this.setAvatar(employeeId, avatarUrl);
  }

  async removeAvatar(companyId: string, employeeId: string, access: AccessContext) {
    await this.access.assertEmployeeInScope(access, 'employee.edit', companyId, employeeId);
    return this.setAvatar(employeeId, null);
  }

  private async setAvatar(employeeId: string, avatarUrl: string | null) {
    const employee = await this.prisma.employee.update({ where: { id: employeeId }, data: { avatarUrl }, select: { id: true, userId: true, avatarUrl: true } });
    await this.prisma.user.update({ where: { id: employee.userId }, data: { avatarUrl } });
    return { id: employee.id, avatarUrl: employee.avatarUrl };
  }

  // ─── Profile completion (self-service checklist) ───────────

  async completion(employeeId: string) {
    const e = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        avatarUrl: true,
        phone: true,
        dateOfBirth: true,
        personal: { select: { currentAddress: true, emergencyContactName: true, emergencyContactPhone: true } },
        bankDetails: { select: { id: true } },
        statutoryInfo: { select: { pan: true } },
      },
    });
    if (!e) throw new NotFoundException('Employee not found');
    const address = e.personal?.currentAddress as { line1?: string; city?: string } | null | undefined;
    const items = [
      { key: 'photo', label: 'Profile photo', done: Boolean(e.avatarUrl) },
      { key: 'phone', label: 'Phone number', done: Boolean(e.phone) },
      { key: 'dateOfBirth', label: 'Date of birth', done: Boolean(e.dateOfBirth) },
      { key: 'address', label: 'Current address', done: Boolean(address?.line1 && address?.city) },
      { key: 'emergency', label: 'Emergency contact', done: Boolean(e.personal?.emergencyContactName && e.personal?.emergencyContactPhone) },
      { key: 'bank', label: 'Bank account', done: Boolean(e.bankDetails) },
      { key: 'pan', label: 'PAN', done: Boolean(e.statutoryInfo?.pan) },
    ];
    return { percent: Math.round((items.filter((i) => i.done).length / items.length) * 100), items };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private address(a: UpdatePersonalDto['currentAddress']): Prisma.InputJsonValue | typeof Prisma.DbNull {
    if (!a) return Prisma.DbNull;
    const clean = Object.fromEntries(Object.entries(a).filter(([, v]) => typeof v === 'string' && v));
    return Object.keys(clean).length ? clean : Prisma.DbNull;
  }

  private maskedBank(bank: { accountHolderName: string; accountLast4: string; ifscCode: string; bankName: string; branchName: string; updatedAt: Date } | null) {
    if (!bank) return null;
    return {
      accountHolderName: bank.accountHolderName,
      accountNumberMasked: maskTail('XXXXXXXX' + bank.accountLast4),
      ifscCode: bank.ifscCode,
      bankName: bank.bankName,
      branchName: bank.branchName,
      updatedAt: bank.updatedAt,
    };
  }

  private maskedStatutory(s: { pan: string | null; aadhaarLast4: string | null; uan: string | null; esicNumber: string | null; pfAccountNo: string | null; taxRegime: string; updatedAt: Date } | null) {
    if (!s) return null;
    return {
      panMasked: s.pan ? maskTail(this.crypto.decrypt(s.pan)) : null,
      aadhaarMasked: s.aadhaarLast4 ? `XXXX XXXX ${s.aadhaarLast4}` : null,
      uan: s.uan,
      esicNumber: s.esicNumber,
      pfAccountNo: s.pfAccountNo,
      taxRegime: s.taxRegime,
      updatedAt: s.updatedAt,
    };
  }
}

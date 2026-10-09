import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AccessContext } from '../access/access.types';
import { NotificationsService } from '../notifications/notifications.service';

const EDIT = 'employee.edit';
const years = (months: number) => {
  const y = Math.round(months / 1.2) / 10;
  return months < 12 ? `${months} month${months === 1 ? '' : 's'}` : `${y} year${y === 1 ? '' : 's'}`;
};

/**
 * Experience before joining. What the person enters themselves waits for HR
 * (anyone who may edit them, never themselves); only the approved value
 * counts anywhere (totals, the preferred-person picker, its filter). What HR
 * enters — on the profile or through the import — is approved at once.
 */
@Injectable()
export class ExperienceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /** A new value from the profile: the person's own goes to HR; HR's is approved. null clears (own: withdraws the pending one). */
  async set(companyId: string, access: AccessContext, employeeId: string, months: number | null) {
    const self = access.employee?.id === employeeId;
    const e = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { firstName: true, lastName: true, userId: true, priorExperienceMonths: true, priorExperiencePendingMonths: true } });
    if (!e) throw new NotFoundException('Employee not found');
    if (self) {
      // Same as what's approved (or a withdrawal): nothing to check
      if (months === null || months === e.priorExperienceMonths) {
        await this.prisma.employee.update({ where: { id: employeeId }, data: { priorExperiencePendingMonths: null, priorExperienceSubmittedAt: null } });
        return this.state(companyId, access, employeeId);
      }
      await this.prisma.employee.update({ where: { id: employeeId }, data: { priorExperiencePendingMonths: months, priorExperienceSubmittedAt: new Date() } });
      const hr = (await this.notifications.companyWideApprovers(companyId, EDIT)).filter((u) => u !== access.userId);
      void this.notifications.notify({
        companyId,
        userIds: hr,
        type: 'profile.experience',
        title: `${e.firstName} ${e.lastName} added ${years(months)} of experience before joining — please verify`,
        body: e.priorExperienceMonths === null ? 'Nothing was recorded before.' : `Recorded now: ${years(e.priorExperienceMonths)}.`,
        link: `/app/employees/${employeeId}?tab=projects`,
        actionLabel: 'Verify',
        email: false,
      });
      return this.state(companyId, access, employeeId);
    }
    await this.access.assertEmployeeInScope(access, EDIT, companyId, employeeId);
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { priorExperienceMonths: months, priorExperiencePendingMonths: null, priorExperienceSubmittedAt: null, priorExperienceVerifiedAt: months === null ? null : new Date(), priorExperienceVerifiedById: months === null ? null : access.userId },
    });
    return this.state(companyId, access, employeeId);
  }

  async approve(companyId: string, access: AccessContext, employeeId: string) {
    const e = await this.reviewable(companyId, access, employeeId);
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { priorExperienceMonths: e.priorExperiencePendingMonths, priorExperiencePendingMonths: null, priorExperienceSubmittedAt: null, priorExperienceVerifiedAt: new Date(), priorExperienceVerifiedById: access.userId },
    });
    void this.tell(companyId, e.userId, `HR verified your experience before joining — ${years(e.priorExperiencePendingMonths!)}`, null);
    return this.state(companyId, access, employeeId);
  }

  async reject(companyId: string, access: AccessContext, employeeId: string, reason: string) {
    const e = await this.reviewable(companyId, access, employeeId);
    await this.prisma.employee.update({ where: { id: employeeId }, data: { priorExperiencePendingMonths: null, priorExperienceSubmittedAt: null } });
    void this.tell(companyId, e.userId, `HR didn’t accept ${years(e.priorExperiencePendingMonths!)} of experience before joining`, `Reason: ${reason}`);
    return this.state(companyId, access, employeeId);
  }

  /** Waiting for HR, within the caller's reach (Home → Needs your action). */
  async pending(companyId: string, access: AccessContext, limit = 5) {
    const scope = this.access.employeeScope(access, EDIT);
    if (!scope) return { total: 0, rows: [] };
    const where = { AND: [scope, { companyId, priorExperiencePendingMonths: { not: null }, employmentStatus: { not: EmploymentStatus.TERMINATED }, ...(access.employee && { id: { not: access.employee.id } }) }] };
    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        orderBy: { priorExperienceSubmittedAt: 'asc' },
        take: limit,
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, priorExperienceMonths: true, priorExperiencePendingMonths: true, priorExperienceSubmittedAt: true },
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { total, rows };
  }

  /** For the profile card: approved value, what waits for HR, who verified, and whether the viewer may verify. */
  async state(companyId: string, access: AccessContext, employeeId: string) {
    const e = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { priorExperienceMonths: true, priorExperiencePendingMonths: true, priorExperienceSubmittedAt: true, priorExperienceVerifiedAt: true, priorExperienceVerifiedById: true },
    });
    if (!e) throw new NotFoundException('Employee not found');
    const verifier = e.priorExperienceVerifiedById ? await this.prisma.user.findUnique({ where: { id: e.priorExperienceVerifiedById }, select: { firstName: true, lastName: true } }) : null;
    const canVerify = access.employee?.id !== employeeId && (await this.reaches(access, companyId, employeeId));
    return {
      priorMonths: e.priorExperienceMonths,
      pendingMonths: e.priorExperiencePendingMonths,
      submittedAt: e.priorExperienceSubmittedAt,
      verifiedAt: e.priorExperienceVerifiedAt,
      verifiedBy: verifier ? `${verifier.firstName} ${verifier.lastName}` : null,
      canVerify,
    };
  }

  private async reviewable(companyId: string, access: AccessContext, employeeId: string) {
    if (access.employee?.id === employeeId) throw new ForbiddenException('Someone else in HR verifies your own experience');
    await this.access.assertEmployeeInScope(access, EDIT, companyId, employeeId);
    const e = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { userId: true, priorExperiencePendingMonths: true } });
    if (!e) throw new NotFoundException('Employee not found');
    if (e.priorExperiencePendingMonths === null) throw new BadRequestException('Nothing is waiting to be verified');
    return e;
  }

  private async reaches(access: AccessContext, companyId: string, employeeId: string) {
    const scope = this.access.employeeScope(access, EDIT);
    if (!scope) return false;
    return (await this.prisma.employee.count({ where: { AND: [{ id: employeeId, companyId }, scope] } })) > 0;
  }

  private tell(companyId: string, userId: string | null, title: string, body: string | null) {
    if (!userId) return;
    return this.notifications.notify({ companyId, userIds: [userId], type: 'profile.experience', title, body, link: '/app/profile?tab=projects', email: false });
  }
}

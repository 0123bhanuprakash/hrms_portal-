import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_POLICY, type PolicyRules } from './attendance-rules';
import { isValidTimeZone, minutesOf } from './time-zone';
import type { UpdatePolicyDto } from './dto';

export interface CompanyPolicy extends PolicyRules {
  timeZone: string;
}

/** The company's attendance rules + time zone (defaults until HR saves a policy). */
@Injectable()
export class AttendancePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string): Promise<CompanyPolicy> {
    const [policy, settings] = await Promise.all([
      this.prisma.attendancePolicy.findUnique({ where: { companyId } }),
      this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } }),
    ]);
    const timeZone = settings?.timezone && isValidTimeZone(settings.timezone) ? settings.timezone : 'Asia/Kolkata';
    if (!policy) return { ...DEFAULT_POLICY, timeZone };
    return {
      workDays: [...policy.workDays].sort(),
      shiftStart: policy.shiftStart,
      shiftEnd: policy.shiftEnd,
      graceMinutes: policy.graceMinutes,
      halfDayMinutes: policy.halfDayMinutes,
      fullDayMinutes: policy.fullDayMinutes,
      regularisationWindowDays: policy.regularisationWindowDays,
      webCheckInEnabled: policy.webCheckInEnabled,
      timeZone,
    };
  }

  async update(companyId: string, dto: UpdatePolicyDto): Promise<CompanyPolicy> {
    const current = await this.get(companyId);
    const next = { ...current, ...Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) } as CompanyPolicy;
    if (minutesOf(next.shiftEnd) <= minutesOf(next.shiftStart)) throw new BadRequestException('Shift end must be after shift start (overnight shifts are not supported yet)');
    if (next.halfDayMinutes >= next.fullDayMinutes) throw new BadRequestException('Half-day hours must be less than full-day hours');
    if (!next.workDays.length) throw new BadRequestException('Choose at least one working day');

    const { timeZone: _tz, ...rules } = next;
    await this.prisma.attendancePolicy.upsert({
      where: { companyId },
      update: rules,
      create: { ...rules, companyId },
    });
    return this.get(companyId);
  }
}

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyStatus, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { holds, type AccessContext } from '../access/access.types';
import { EmailService } from '../email/email.service';
import { addDays, isValidTimeZone, localDateKey, weekdayOfKey, zonedInstant } from '../attendance/time-zone';
import { ReportsService } from './reports.service';
import { ReportsOverviewService } from './reports-overview.service';
import type { SaveScheduleDto } from './dto';

const EVERY_MS = 5 * 60_000;
const VIEW = 'report.view';
const PMO = 'project.manage';
const LABEL: Record<string, string> = { overview: 'Overview', people: 'People', attendance: 'Attendance & leave', utilisation: 'Utilisation' };

type Schedule = Prisma.ReportScheduleGetPayload<object>;

/** When the schedule next fires after `after` (company time zone). */
export function nextRun(s: Pick<Schedule, 'frequency' | 'dayOfWeek' | 'dayOfMonth' | 'hour'>, tz: string, after = new Date()): Date {
  const hh = `${String(s.hour).padStart(2, '0')}:00`;
  let day = localDateKey(after, tz);
  for (let i = 0; i < 70; i++, day = addDays(day, 1)) {
    const iso = ((weekdayOfKey(day) + 6) % 7) + 1; // 1 = Monday … 7 = Sunday
    const ok = s.frequency === 'DAILY' || (s.frequency === 'WEEKLY' && iso === (s.dayOfWeek ?? 1)) || (s.frequency === 'MONTHLY' && Number(day.slice(8)) === (s.dayOfMonth ?? 1));
    if (!ok) continue;
    const at = zonedInstant(day, hh, tz);
    if (at > after) return at;
  }
  throw new Error('No next run found');
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Reports emailed on a schedule (daily / weekly / monthly at a local hour).
 * Each recipient's copy is built with their own access, so nobody receives
 * numbers they couldn't open in the app.
 */
@Injectable()
export class ReportSchedulesService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ReportSchedulesService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly reports: ReportsService,
    private readonly overview: ReportsOverviewService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('REMINDERS_ENABLED') === 'false') return;
    this.timer = setInterval(() => void this.runDue(), EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async timeZone(companyId: string) {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    return s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata';
  }

  /** People in the company who can receive reports (they can open Reports). */
  async recipients(companyId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        status: UserStatus.ACTIVE,
        userRoles: { some: { role: { rolePermissions: { some: { permission: { key: { in: [VIEW, PMO] } } } } } } },
      },
      orderBy: { firstName: 'asc' },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
    });
    return users;
  }

  async list(companyId: string, userId: string) {
    const rows = await this.prisma.reportSchedule.findMany({ where: { companyId, ownerId: userId }, orderBy: { createdAt: 'asc' } });
    const ids = [...new Set(rows.flatMap((r) => r.recipientIds))];
    const people = ids.length ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, email: true } }) : [];
    return rows.map((r) => ({ ...r, recipients: r.recipientIds.map((id) => people.find((p) => p.id === id)).filter(Boolean) }));
  }

  private async checkRecipients(companyId: string, ids: string[]) {
    const allowed = new Set((await this.recipients(companyId)).map((u) => u.id));
    const bad = ids.filter((id) => !allowed.has(id));
    if (bad.length) throw new BadRequestException('Some recipients can’t see reports');
    if (!ids.length) throw new BadRequestException('Pick at least one person');
  }

  private validate(dto: SaveScheduleDto) {
    if (dto.frequency === 'WEEKLY' && !dto.dayOfWeek) throw new BadRequestException('Pick a day of the week');
    if (dto.frequency === 'MONTHLY' && !dto.dayOfMonth) throw new BadRequestException('Pick a day of the month');
  }

  async create(companyId: string, userId: string, dto: SaveScheduleDto) {
    this.validate(dto);
    await this.checkRecipients(companyId, [...new Set(dto.recipientIds)]);
    const tz = await this.timeZone(companyId);
    const data = {
      report: dto.report,
      frequency: dto.frequency,
      dayOfWeek: dto.frequency === 'WEEKLY' ? dto.dayOfWeek ?? 1 : null,
      dayOfMonth: dto.frequency === 'MONTHLY' ? dto.dayOfMonth ?? 1 : null,
      hour: dto.hour,
      recipientIds: [...new Set(dto.recipientIds)],
      attachCsv: dto.attachCsv ?? false,
      filters: { ...(dto.departmentId && { departmentId: dto.departmentId }), ...(dto.locationId && { locationId: dto.locationId }) },
      active: dto.active ?? true,
    };
    return this.prisma.reportSchedule.create({ data: { ...data, companyId, ownerId: userId, nextRunAt: nextRun(data, tz) } });
  }

  private async own(companyId: string, userId: string, id: string) {
    const s = await this.prisma.reportSchedule.findFirst({ where: { id, companyId } });
    if (!s) throw new NotFoundException('Schedule not found');
    if (s.ownerId !== userId) throw new ForbiddenException('Only the person who set it up can change it');
    return s;
  }

  async update(companyId: string, userId: string, id: string, dto: SaveScheduleDto) {
    await this.own(companyId, userId, id);
    this.validate(dto);
    await this.checkRecipients(companyId, [...new Set(dto.recipientIds)]);
    const tz = await this.timeZone(companyId);
    const data = {
      report: dto.report,
      frequency: dto.frequency,
      dayOfWeek: dto.frequency === 'WEEKLY' ? dto.dayOfWeek ?? 1 : null,
      dayOfMonth: dto.frequency === 'MONTHLY' ? dto.dayOfMonth ?? 1 : null,
      hour: dto.hour,
      recipientIds: [...new Set(dto.recipientIds)],
      attachCsv: dto.attachCsv ?? false,
      filters: { ...(dto.departmentId && { departmentId: dto.departmentId }), ...(dto.locationId && { locationId: dto.locationId }) },
      active: dto.active ?? true,
    };
    return this.prisma.reportSchedule.update({ where: { id }, data: { ...data, nextRunAt: nextRun(data, tz) } });
  }

  async remove(companyId: string, userId: string, id: string) {
    await this.own(companyId, userId, id);
    await this.prisma.reportSchedule.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** "Send now" — also how a schedule is tried out. */
  async sendNow(companyId: string, userId: string, id: string) {
    const s = await this.own(companyId, userId, id);
    const sent = await this.send(s);
    return { id, sent };
  }

  /** Background: every due schedule, then its next time. */
  async runDue(now = new Date()): Promise<number> {
    let sent = 0;
    try {
      const due = await this.prisma.reportSchedule.findMany({ where: { active: true, nextRunAt: { lte: now }, company: { status: CompanyStatus.ACTIVE } }, take: 50 });
      for (const s of due) {
        try {
          sent += await this.send(s);
        } catch (e) {
          this.logger.warn(`Report schedule ${s.id} failed: ${(e as Error).message}`);
        }
        const tz = await this.timeZone(s.companyId);
        await this.prisma.reportSchedule.update({ where: { id: s.id }, data: { nextRunAt: nextRun(s, tz, now) } });
      }
    } catch (e) {
      this.logger.warn(`Report schedules run failed: ${(e as Error).message}`);
    }
    return sent;
  }

  /** One email per recipient, built with that person's own access. */
  private async send(s: Schedule): Promise<number> {
    const users = await this.prisma.user.findMany({ where: { id: { in: s.recipientIds }, companyId: s.companyId, status: UserStatus.ACTIVE }, select: { id: true, email: true, firstName: true } });
    const filters = (s.filters ?? {}) as { departmentId?: string; locationId?: string };
    const webUrl = this.config.get<string>('webUrl') ?? 'http://localhost:3000';
    let sent = 0;
    for (const u of users) {
      const access = await this.access.forUser(u.id);
      const canView = access.features.has('insights.reports') && holds(access, VIEW);
      const canUtil = access.features.has('work.projects') && (holds(access, PMO) || holds(access, VIEW));
      if (s.report === 'utilisation' ? !canUtil : !canView) continue;
      const { html, attachments } = await this.build(s, access, filters, webUrl, u.firstName);
      await this.email.send({ to: u.email, subject: `${LABEL[s.report] ?? 'Report'} report — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, html, attachments });
      sent++;
    }
    await this.prisma.reportSchedule.update({ where: { id: s.id }, data: { lastSentAt: new Date() } });
    return sent;
  }

  private async build(s: Schedule, access: AccessContext, filters: { departmentId?: string; locationId?: string }, webUrl: string, firstName: string) {
    const c = s.companyId;
    const rows: Array<[string, string, string?]> = [];
    const notes: string[] = [];
    const attachments: Array<{ filename: string; content: string; contentType: string }> = [];
    const signed = (n: number | null | undefined, unit = '') => (n === null || n === undefined ? '' : `${n > 0 ? '+' : ''}${n}${unit}`);
    if (s.report === 'overview') {
      const o = await this.overview.overview(c, access, filters);
      rows.push(['Headcount', String(o.kpis.headcount.value ?? '—'), signed(o.kpis.headcount.change)]);
      rows.push(['Attendance rate', o.kpis.attendanceRatePct.value === null ? '—' : `${o.kpis.attendanceRatePct.value}%`, signed(o.kpis.attendanceRatePct.change, ' pts')]);
      rows.push(['Leave days taken', String(o.kpis.leaveDays.value ?? 0), signed(o.kpis.leaveDays.change)]);
      rows.push(['Attrition · 12 months', `${o.kpis.attritionPct.value ?? 0}%`, signed(o.kpis.attritionPct.change, ' pts')]);
      if (o.kpis.billablePct) rows.push(['Billable time', o.kpis.billablePct.value === null ? '—' : `${o.kpis.billablePct.value}%`, signed(o.kpis.billablePct.change, ' pts')]);
      notes.push(...o.highlights.map((h) => `<b>${esc(h.title)}</b> — ${esc(h.detail)}`));
    } else if (s.report === 'people') {
      const p = await this.reports.people(c, access, filters);
      rows.push(['Headcount', String(p.headcount)], ['Joined · 12 months', String(p.joiners12)], ['Left · 12 months', String(p.leavers12)], ['Attrition · 12 months', `${p.attritionPct}%`]);
      if (p.probation.length) notes.push(`${p.probation.length} on probation`);
      if (p.notice.length) notes.push(`${p.notice.length} serving notice`);
      if (s.attachCsv && holds(access, 'report.export')) attachments.push({ filename: 'employees.csv', content: await this.reports.peopleCsv(c, access), contentType: 'text/csv' });
    } else if (s.report === 'attendance') {
      const a = await this.reports.attendance(c, access, filters);
      rows.push(['Attendance rate', a.attendanceRatePct === null ? '—' : `${a.attendanceRatePct}%`], ['Late arrivals', String(a.lateArrivals)], ['Work from home days', String(a.wfhDays)], ['Leave days taken', String(a.leaveByType.reduce((n, x) => n + x.days, 0))]);
      if (a.leaveBalances.plentyLeft.length) notes.push(`${a.leaveBalances.plentyLeft.length} people have 15+ days of leave left`);
    } else {
      const u = await this.reports.utilisation(c, access, filters);
      rows.push(['People', String(u.people)], ['Average allocation', `${u.avgAllocationPct}%`], ['On the bench', String(u.bench)]);
      if (u.utilisationPct !== null) rows.push(['Logged ÷ capacity', `${u.utilisationPct}%`]);
      if (u.billablePct !== null) rows.push(['Billable', `${u.billablePct}%`]);
      if (s.attachCsv) {
        const csv = await this.reports.utilisationCsv(c, access, filters).catch(() => null);
        if (csv) attachments.push({ filename: csv.name, content: csv.body, contentType: 'text/csv' });
      }
    }
    const tab = s.report === 'attendance' ? 'attendance' : s.report;
    const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.55;color:#111827;max-width:560px">
      <p>Hi ${esc(firstName)}, here’s your ${esc(LABEL[s.report]?.toLowerCase() ?? 'report')} report.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0">${rows
        .map(([l, v, d]) => `<tr><td style="padding:8px 10px;border-bottom:1px solid #eef0f5;color:#6b7280">${esc(l)}</td><td style="padding:8px 10px;border-bottom:1px solid #eef0f5;font-weight:800;text-align:right">${esc(v)}</td><td style="padding:8px 10px;border-bottom:1px solid #eef0f5;color:#6b7280;text-align:right;font-size:12px">${d ? `${esc(d)} vs before` : ''}</td></tr>`)
        .join('')}</table>
      ${notes.length ? `<ul style="padding-left:18px;margin:0 0 12px">${notes.map((n) => `<li style="margin:4px 0">${n}</li>`).join('')}</ul>` : ''}
      <p><a href="${webUrl}/app/reports?tab=${tab}" style="display:inline-block;background:#4f46e5;color:#fff;padding:9px 14px;border-radius:8px;text-decoration:none;font-weight:700">Open the report</a></p>
      <p style="color:#9ca3af;font-size:12px">Numbers cover only the people you can see in the app. To stop these emails, ask whoever set them up, or change it under Reports → Schedule.</p>
    </div>`;
    return { html, attachments };
  }
}

import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyStatus, LeaveApprovalStatus, LeaveStatus, RegularisationStatus, TimesheetStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService, dateRange } from '../notifications/notifications.service';
import { addDays, keyFromDate, localDateKey } from '../attendance/time-zone';

const DAY = 86_400_000;
const EVERY_MS = 60 * 60_000;
/** Remind people with a team this many days before their leave if nobody covers */
const REMIND_DAYS_BEFORE = 2;


/**
 * Around delegation: spotting approved leave that needs a cover, suggesting
 * good covers, the team timeline, the "while you were away" recap, and a
 * reminder 2 days before leave when nobody covers yet.
 */
/** Gaps listed on the company hand-over chart (the rest are counted) */
const GAPS_SHOWN = 25;

@Injectable()
export class CoverService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CoverService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('REMINDERS_ENABLED') === 'false') return;
    this.timer = setInterval(() => void this.remindUncovered().catch((e) => this.logger.error(e)), EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async timeZone(companyId: string) {
    return (await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } }))?.timezone || 'Asia/Kolkata';
  }

  /** People who approve something for others (they have a team or a project to lead). */
  /** Which of these people approve for others (direct reports, or lead / manage a project) — two queries for any number. */
  private async withTeams(companyId: string, employeeIds: string[]): Promise<Set<string>> {
    if (!employeeIds.length) return new Set();
    const [reports, leads] = await Promise.all([
      this.prisma.employee.groupBy({ by: ['reportingManagerId'], where: { companyId, reportingManagerId: { in: employeeIds }, employmentStatus: { not: 'TERMINATED' } } }),
      this.prisma.projectMember.groupBy({ by: ['employeeId'], where: { employeeId: { in: employeeIds }, role: { in: ['TEAM_LEAD', 'MANAGER'] }, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] } }),
    ]);
    return new Set([...reports.map((r) => r.reportingManagerId!), ...leads.map((l) => l.employeeId)]);
  }

  private async hasTeam(companyId: string, employeeId: string) {
    const [reports, leads] = await Promise.all([
      this.prisma.employee.count({ where: { companyId, reportingManagerId: employeeId, employmentStatus: { not: 'TERMINATED' } } }),
      this.prisma.projectMember.count({ where: { employeeId, role: { in: ['TEAM_LEAD', 'MANAGER'] }, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] } }),
    ]);
    return reports + leads > 0;
  }

  /** My approved leave in the next 45 days, each with whether someone covers all of it. */
  async myLeave(companyId: string, userId: string) {
    const me = await this.prisma.employee.findFirst({ where: { companyId, userId }, select: { id: true } });
    if (!me) return [];
    const today = localDateKey(new Date(), await this.timeZone(companyId));
    const rows = await this.prisma.leaveRequest.findMany({
      where: { companyId, employeeId: me.id, status: LeaveStatus.APPROVED, endDate: { gte: new Date(`${today}T00:00:00Z`) }, startDate: { lte: new Date(Date.parse(`${today}T00:00:00Z`) + 45 * DAY) } },
      select: { id: true, startDate: true, endDate: true, leaveType: { select: { name: true } } },
      orderBy: { startDate: 'asc' },
    });
    const out = [];
    for (const r of rows) {
      const from = keyFromDate(r.startDate);
      const to = keyFromDate(r.endDate);
      const cover = await this.prisma.approvalDelegation.findFirst({
        where: { companyId, delegatorId: userId, revokedAt: null, startsAt: { lte: new Date(`${from}T12:00:00Z`) }, endsAt: { gte: new Date(`${to}T12:00:00Z`) } },
        select: { delegate: { select: { id: true, firstName: true, lastName: true } } },
      });
      out.push({ id: r.id, from, to, type: r.leaveType?.name ?? 'Leave', inDays: Math.round((Date.parse(from) - Date.parse(today)) / DAY), coveredBy: cover ? { id: cover.delegate.id, name: `${cover.delegate.firstName} ${cover.delegate.lastName}` } : null });
    }
    return out;
  }

  /**
   * Good covers for my approvals from `from` to `to`: my manager and the people
   * who share it first, then people who already approve, same department;
   * anyone away during those days goes last.
   */
  async suggest(companyId: string, userId: string, from: string, to: string) {
    const me = await this.prisma.employee.findFirst({ where: { companyId, userId }, select: { id: true, reportingManagerId: true, departmentId: true } });
    const people = (
      await this.prisma.employee.findMany({
        where: { companyId, employmentStatus: { not: 'TERMINATED' }, user: { status: UserStatus.ACTIVE }, NOT: { userId } },
        select: { id: true, userId: true, firstName: true, lastName: true, avatarUrl: true, reportingManagerId: true, departmentId: true, designation: { select: { name: true } } },
      })
    ).filter((p) => p.userId);
    const approvers = new Set(
      (
        await this.prisma.userRole.findMany({
          where: { companyId, user: { status: UserStatus.ACTIVE }, role: { status: 'ACTIVE', OR: [{ isOwner: true }, { rolePermissions: { some: { permission: { key: { in: ['leave.approve', 'attendance.approve'] } } } } }] } },
          select: { userId: true },
        })
      ).map((r) => r.userId),
    );
    const away = await this.prisma.leaveRequest.findMany({
      where: { companyId, status: { in: [LeaveStatus.APPROVED, LeaveStatus.PENDING] }, startDate: { lte: new Date(`${to}T00:00:00Z`) }, endDate: { gte: new Date(`${from}T00:00:00Z`) } },
      select: { employeeId: true, startDate: true, endDate: true },
    });
    const awayDays = new Map<string, number>();
    for (const a of away) {
      const s = Math.max(Date.parse(`${from}T00:00:00Z`), a.startDate.getTime());
      const e = Math.min(Date.parse(`${to}T00:00:00Z`), a.endDate.getTime());
      awayDays.set(a.employeeId, (awayDays.get(a.employeeId) ?? 0) + Math.round((e - s) / DAY) + 1);
    }
    const total = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
    return people
      .map((p) => {
        const reasons: string[] = [];
        let score = 0;
        if (me?.reportingManagerId && p.id === me.reportingManagerId) {
          score += 4;
          reasons.push('Your manager');
        } else if (me?.reportingManagerId && p.reportingManagerId === me.reportingManagerId) {
          score += 3;
          reasons.push('Same manager as you');
        }
        if (approvers.has(p.userId!)) {
          score += 2;
          reasons.push('Already approves for a team');
        }
        if (me?.departmentId && p.departmentId === me.departmentId) {
          score += 1;
          reasons.push('Same department');
        }
        const off = awayDays.get(p.id) ?? 0;
        if (off) score -= 10;
        return {
          userId: p.userId!,
          firstName: p.firstName,
          lastName: p.lastName,
          avatarUrl: p.avatarUrl,
          title: p.designation?.name ?? null,
          reasons,
          awayDays: off,
          available: off ? `Away ${off} of ${total} day${total === 1 ? '' : 's'}` : `In all ${total} day${total === 1 ? '' : 's'}`,
          score,
        };
      })
      .filter((p) => p.score > 0 || p.reasons.length)
      .sort((a, b) => b.score - a.score || a.firstName.localeCompare(b.firstName))
      .slice(0, 6);
  }

  /** Me and my direct reports: approved leave and who covers, for the next weeks. */
  async timeline(companyId: string, userId: string, from: string, to: string) {
    const me = await this.prisma.employee.findFirst({ where: { companyId, userId }, select: { id: true } });
    if (!me) return { from, to, rows: [] };
    const team = await this.prisma.employee.findMany({
      where: { companyId, OR: [{ id: me.id }, { reportingManagerId: me.id }], employmentStatus: { not: 'TERMINATED' } },
      select: { id: true, userId: true, firstName: true, lastName: true, avatarUrl: true },
      orderBy: { firstName: 'asc' },
    });
    const ids = team.map((t) => t.id);
    const userIds = team.map((t) => t.userId).filter((x): x is string => Boolean(x));
    const [leave, delegations] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: { companyId, employeeId: { in: ids }, status: LeaveStatus.APPROVED, startDate: { lte: new Date(`${to}T00:00:00Z`) }, endDate: { gte: new Date(`${from}T00:00:00Z`) } },
        select: { employeeId: true, startDate: true, endDate: true },
      }),
      this.prisma.approvalDelegation.findMany({
        where: { companyId, delegatorId: { in: userIds }, revokedAt: null, startsAt: { lte: new Date(`${to}T23:59:59Z`) }, endsAt: { gte: new Date(`${from}T00:00:00Z`) } },
        select: { delegatorId: true, startsAt: true, endsAt: true, delegate: { select: { firstName: true, lastName: true } } },
      }),
    ]);
    const leadsTeam = await this.withTeams(companyId, team.map((t) => t.id));
    const rows = team
      .sort((a, b) => (a.id === me.id ? -1 : b.id === me.id ? 1 : 0))
      .map((t) => {
        const off = leave.filter((l) => l.employeeId === t.id).map((l) => ({ from: keyFromDate(l.startDate), to: keyFromDate(l.endDate) }));
        const covers = delegations.filter((d) => d.delegatorId === t.userId).map((d) => ({ from: keyFromDate(d.startsAt), to: keyFromDate(d.endsAt), by: `${d.delegate.firstName} ${d.delegate.lastName}` }));
        // Leave of someone who approves for others, with no cover
        const gaps = leadsTeam.has(t.id) ? off.filter((o) => !covers.some((c) => c.from <= o.from && c.to >= o.to)) : [];
        return { employeeId: t.id, userId: t.userId, firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl, isMe: t.id === me.id, off, covers, gaps };
      });
    return { from, to, rows };
  }

  /** Admins: approvers on approved leave in the next 30 days with nobody covering. */
  async gaps(companyId: string) {
    const today = localDateKey(new Date(), await this.timeZone(companyId));
    const until = addDays(today, 30);
    const leave = await this.prisma.leaveRequest.findMany({
      where: { companyId, status: LeaveStatus.APPROVED, endDate: { gte: new Date(`${today}T00:00:00Z`) }, startDate: { lte: new Date(`${until}T00:00:00Z`) } },
      select: { employeeId: true, startDate: true, endDate: true, employee: { select: { userId: true, firstName: true, lastName: true } } },
      orderBy: { startDate: 'asc' },
    });
    // Three queries in all (not two per leave): who approves for others, and their covers
    const leads = await this.withTeams(companyId, [...new Set(leave.map((l) => l.employeeId))]);
    const mine = leave.filter((l) => leads.has(l.employeeId) && l.employee.userId);
    const covers = mine.length
      ? await this.prisma.approvalDelegation.findMany({
          where: { companyId, delegatorId: { in: [...new Set(mine.map((l) => l.employee.userId!))] }, revokedAt: null, endsAt: { gte: new Date(`${today}T00:00:00Z`) } },
          select: { delegatorId: true, startsAt: true, endsAt: true },
        })
      : [];
    const out = [];
    for (const l of mine) {
      const from = keyFromDate(l.startDate);
      const to = keyFromDate(l.endDate);
      const covered = covers.some((c) => c.delegatorId === l.employee.userId && c.startsAt <= new Date(`${from}T12:00:00Z`) && c.endsAt >= new Date(`${to}T12:00:00Z`));
      if (!covered) out.push({ userId: l.employee.userId!, name: `${l.employee.firstName} ${l.employee.lastName}`, from, to });
    }
    // The soonest 25; `total` says how many there are
    return { rows: out.slice(0, GAPS_SHOWN), total: out.length };
  }

  /** "While you were away": what my covers decided for me in hand-overs that ended in the last 10 days. */
  async recap(companyId: string, userId: string) {
    const since = new Date(Date.now() - 10 * DAY);
    const handovers = await this.prisma.approvalDelegation.findMany({
      where: { companyId, delegatorId: userId, startsAt: { lt: new Date() }, OR: [{ endsAt: { gte: since, lte: new Date() } }, { revokedAt: { gte: since } }] },
      select: { id: true, startsAt: true, endsAt: true, revokedAt: true, delegate: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { endsAt: 'desc' },
      take: 3,
    });
    const me = await this.prisma.employee.findFirst({ where: { companyId, userId }, select: { id: true } });
    const out = [];
    for (const h of handovers) {
      const end = h.revokedAt ?? h.endsAt;
      const window = { gte: h.startsAt, lte: end };
      const [leave, expenses, corrections, timesheets] = await Promise.all([
        this.prisma.leaveApproval.findMany({
          where: { onBehalfOfId: userId, actedById: h.delegate.id, actedAt: window },
          select: { status: true, leaveRequest: { select: { startDate: true, endDate: true, employee: { select: { firstName: true } } } } },
        }),
        this.prisma.expenseApproval.findMany({
          where: { onBehalfOfId: userId, actedById: h.delegate.id, actedAt: window },
          select: { status: true, claim: { select: { title: true, employee: { select: { firstName: true } } } } },
        }),
        me
          ? this.prisma.attendanceRegularisation.findMany({
              where: { companyId, reviewedById: h.delegate.id, reviewedAt: window, employee: { reportingManagerId: me.id } },
              select: { status: true, date: true, employee: { select: { firstName: true } } },
            })
          : Promise.resolve([]),
        me
          ? this.prisma.timesheet.findMany({
              where: { companyId, decidedById: h.delegate.id, decidedAt: window, employee: { reportingManagerId: me.id } },
              select: { status: true, employee: { select: { firstName: true } } },
            })
          : Promise.resolve([]),
      ]);
      const items = [
        ...leave.map((l) => ({ kind: 'leave', title: `Leave · ${l.leaveRequest.employee.firstName} · ${dateRange(keyFromDate(l.leaveRequest.startDate), keyFromDate(l.leaveRequest.endDate))}`, approved: l.status === LeaveApprovalStatus.APPROVED })),
        ...expenses.map((e) => ({ kind: 'expense', title: `Expense · ${e.claim.employee.firstName} · ${e.claim.title}`, approved: e.status === LeaveApprovalStatus.APPROVED })),
        ...corrections.map((c) => ({ kind: 'attendance', title: `Attendance · ${c.employee.firstName} · ${dateRange(keyFromDate(c.date), keyFromDate(c.date))}`, approved: c.status === RegularisationStatus.APPROVED })),
        ...timesheets.map((t) => ({ kind: 'timesheet', title: `Timesheet · ${t.employee.firstName}`, approved: t.status === TimesheetStatus.APPROVED })),
      ];
      out.push({
        id: h.id,
        delegate: { id: h.delegate.id, name: `${h.delegate.firstName} ${h.delegate.lastName}` },
        from: h.startsAt,
        to: end,
        approved: items.filter((i) => i.approved).length,
        rejected: items.filter((i) => !i.approved).length,
        items: items.slice(0, 8),
      });
    }
    return out;
  }

  /** Remind people with a team, 2 days before approved leave, when nobody covers yet. */
  async remindUncovered(now = new Date(), onlyCompanyId?: string): Promise<number> {
    let sent = 0;
    const companies = await this.prisma.company.findMany({ where: { status: CompanyStatus.ACTIVE, ...(onlyCompanyId && { id: onlyCompanyId }) }, select: { id: true } });
    for (const { id: companyId } of companies) {
      const today = localDateKey(now, await this.timeZone(companyId));
      const day = addDays(today, REMIND_DAYS_BEFORE);
      const leave = await this.prisma.leaveRequest.findMany({
        where: { companyId, status: LeaveStatus.APPROVED, startDate: new Date(`${day}T00:00:00Z`) },
        select: { id: true, startDate: true, endDate: true, employeeId: true, employee: { select: { userId: true } } },
      });
      for (const l of leave) {
        if (!(await this.hasTeam(companyId, l.employeeId))) continue;
        const from = keyFromDate(l.startDate);
        const to = keyFromDate(l.endDate);
        const covered = await this.prisma.approvalDelegation.count({
          where: { companyId, delegatorId: l.employee.userId!, revokedAt: null, startsAt: { lte: new Date(`${from}T12:00:00Z`) }, endsAt: { gte: new Date(`${to}T12:00:00Z`) } },
        });
        if (covered) continue;
        sent += await this.notifications.notify({
          companyId,
          userIds: [l.employee.userId],
          type: 'delegation.reminder',
          title: `Your leave starts ${dateRange(from, from)} — who covers your approvals?`,
          body: `You're off ${dateRange(from, to)}. Hand your approvals to a colleague so your team isn't kept waiting.`,
          link: '/app/delegations',
          actionLabel: 'Find someone to cover',
          dedupeKey: `delegation-remind:${l.id}`,
        });
      }
    }
    return sent;
  }
}


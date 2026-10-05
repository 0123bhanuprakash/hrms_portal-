import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AssetRequestStatus, LeaveApprovalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from '../access/entitlement.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dateFromKey, isValidTimeZone, keyFromDate, localDateKey } from '../attendance/time-zone';
import { AssetTypesService } from './asset-types.service';
import type { KitPreviewQueryDto, SaveKitRuleDto } from './dto';

type Item = { typeId: string; qty: number };
const SELECT = { id: true, name: true, isBase: true, roleKeys: true, designationContains: true, departmentIds: true, items: true, onPromotion: true, isActive: true, sortOrder: true } satisfies Prisma.StarterKitRuleSelect;
type Rule = Prisma.StarterKitRuleGetPayload<{ select: typeof SELECT }>;

/**
 * Starter kits: who gets what when they join. Rules add up — everyone's base
 * kit plus extras by role (manager, team lead), designation ("Senior …") or
 * department. A new employee's kit goes straight to IT to prepare (no
 * approvals — company policy). Rules marked "on promotion" also apply when
 * someone moves into the group later (new manager → monitor).
 */
@Injectable()
export class AssetKitsService {
  private readonly logger = new Logger(AssetKitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly types: AssetTypesService,
    private readonly entitlements: EntitlementService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(companyId: string) {
    await this.ensureDefaults(companyId);
    const [rules, types] = await Promise.all([
      this.prisma.starterKitRule.findMany({ where: { companyId }, select: SELECT, orderBy: [{ isBase: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.types.list(companyId, true),
    ]);
    const byId = new Map(types.map((t) => [t.id, t]));
    return rules.map((r) => ({ ...r, items: (r.items as Item[]).map((i) => ({ ...i, type: byId.get(i.typeId) ? { id: i.typeId, name: byId.get(i.typeId)!.name, icon: byId.get(i.typeId)!.icon } : null })).filter((i) => i.type) }));
  }

  async save(companyId: string, id: string | null, dto: SaveKitRuleDto) {
    if (id && !(await this.prisma.starterKitRule.count({ where: { id, companyId } }))) throw new NotFoundException('Kit rule not found');
    const types = new Set((await this.types.list(companyId, true)).map((t) => t.id));
    if (!dto.items.length) throw new BadRequestException('Add at least one item');
    if (dto.items.some((i) => !types.has(i.typeId))) throw new BadRequestException('Unknown asset type');
    const isBase = dto.isBase ?? false;
    if (!isBase && !dto.roleKeys?.length && !dto.designationContains && !dto.departmentIds?.length) throw new BadRequestException('Say who gets it — a role, a designation or a department (or make it the base kit)');
    const data = {
      name: dto.name,
      isBase,
      roleKeys: dto.roleKeys ?? [],
      designationContains: dto.designationContains ?? null,
      departmentIds: dto.departmentIds ?? [],
      items: dto.items.map((i) => ({ typeId: i.typeId, qty: i.qty })),
      onPromotion: dto.onPromotion ?? true,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 100,
    };
    const r = id ? await this.prisma.starterKitRule.update({ where: { id }, data, select: { id: true } }) : await this.prisma.starterKitRule.create({ data: { ...data, companyId }, select: { id: true } });
    return (await this.list(companyId)).find((x) => x.id === r.id);
  }

  async remove(companyId: string, id: string) {
    const { count } = await this.prisma.starterKitRule.deleteMany({ where: { id, companyId } });
    if (!count) throw new NotFoundException('Kit rule not found');
    return { id, deleted: true };
  }

  /** What someone with these details would get (add-employee form). */
  async preview(companyId: string, q: KitPreviewQueryDto) {
    const designation = q.designationId ? (await this.prisma.designation.findFirst({ where: { id: q.designationId, companyId }, select: { name: true } }))?.name ?? null : null;
    const roleKeys = (q.roleKeys ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return this.kitFor(companyId, { designation, departmentId: q.departmentId ?? null, roleKeys }, false);
  }

  /** New employee (or a promotion): create the kit as approved requests for IT to prepare. */
  async provision(companyId: string, employeeId: string, why: 'joined' | 'promotion') {
    try {
      if (!(await this.enabled(companyId))) return { created: 0 };
      const e = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId },
        select: { id: true, firstName: true, lastName: true, joiningDate: true, departmentId: true, designation: { select: { name: true } }, user: { select: { userRoles: { select: { role: { select: { key: true } } } } } } },
      });
      if (!e) return { created: 0 };
      const kit = await this.kitFor(companyId, { designation: e.designation?.name ?? null, departmentId: e.departmentId, roleKeys: e.user.userRoles.map((u) => u.role.key).filter((k): k is string => Boolean(k)) }, why === 'promotion');
      if (!kit.items.length) return { created: 0 };
      // Only what they don't already have (held, or an open request)
      const [held, open] = await Promise.all([
        this.prisma.assetAssignment.findMany({ where: { companyId, employeeId, returnedAt: null }, select: { asset: { select: { typeId: true } } } }),
        this.prisma.assetRequest.findMany({ where: { companyId, employeeId, status: { in: [AssetRequestStatus.PENDING, AssetRequestStatus.APPROVED] } }, select: { typeId: true } }),
      ]);
      const have = (typeId: string) => held.filter((h) => h.asset.typeId === typeId).length + open.filter((o) => o.typeId === typeId).length;
      const today = await this.todayKey(companyId);
      const joins = keyFromDate(e.joiningDate);
      const neededBy = dateFromKey(joins > today ? joins : today);
      const reason = why === 'joined' ? `Starter kit — ${kit.rules.join(', ')}` : `New role — ${kit.rules.join(', ')}`;
      const rows: Prisma.AssetRequestCreateManyInput[] = [];
      for (const i of kit.items) {
        for (let n = have(i.typeId); n < i.qty; n++) {
          rows.push({
            companyId,
            employeeId,
            typeId: i.typeId,
            reason,
            source: 'KIT',
            status: AssetRequestStatus.APPROVED,
            neededBy,
            itStatus: LeaveApprovalStatus.SKIPPED,
            hrStatus: LeaveApprovalStatus.SKIPPED,
          });
        }
      }
      if (!rows.length) return { created: 0 };
      await this.prisma.assetRequest.createMany({ data: rows });
      const it = await this.notifications.companyWideApprovers(companyId, 'asset.manage');
      void this.notifications.notify({
        companyId,
        userIds: it,
        type: 'asset.kit',
        title: why === 'joined' ? `Prepare a starter kit for ${e.firstName} ${e.lastName} (joins ${joins})` : `${e.firstName} ${e.lastName} has a new role — hand over ${kit.items.map((i) => i.name).join(', ')}`,
        body: kit.items.map((i) => `${i.qty > 1 ? `${i.qty} × ` : ''}${i.name}`).join(', '),
        link: '/app/assets/requests?view=joiners',
        email: false,
      });
      return { created: rows.length };
    } catch (err) {
      this.logger.error(`Starter kit for ${employeeId} failed`, err as Error);
      return { created: 0 };
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async kitFor(companyId: string, who: { designation: string | null; departmentId: string | null; roleKeys: string[] }, promotionOnly: boolean) {
    const rules = (await this.list(companyId)).filter((r) => r.isActive && (!promotionOnly || (r.onPromotion && !r.isBase)));
    const matches = rules.filter(
      (r) =>
        r.isBase ||
        r.roleKeys.some((k) => who.roleKeys.includes(k)) ||
        Boolean(r.designationContains && who.designation?.toLowerCase().includes(r.designationContains.toLowerCase())) ||
        Boolean(who.departmentId && r.departmentIds.includes(who.departmentId)),
    );
    const items = new Map<string, { typeId: string; name: string; icon: string; qty: number }>();
    for (const r of matches) {
      for (const i of r.items) {
        // Rules add up by type; the same type in two rules counts once (the larger quantity)
        const cur = items.get(i.typeId);
        items.set(i.typeId, { typeId: i.typeId, name: i.type!.name, icon: i.type!.icon, qty: Math.max(cur?.qty ?? 0, i.qty) });
      }
    }
    return { rules: matches.map((r) => r.name), items: [...items.values()] };
  }

  private async ensureDefaults(companyId: string) {
    if (await this.prisma.starterKitRule.count({ where: { companyId } })) return;
    const types = await this.types.list(companyId, true);
    const t = (prefix: string) => types.find((x) => x.prefix === prefix)?.id;
    const base = [t('LAP'), t('IDC')].filter((x): x is string => Boolean(x));
    const extra = [t('MON')].filter((x): x is string => Boolean(x));
    const rows: Prisma.StarterKitRuleCreateManyInput[] = [];
    if (base.length) rows.push({ companyId, name: 'Everyone', isBase: true, items: base.map((typeId) => ({ typeId, qty: 1 })), onPromotion: false, sortOrder: 0 });
    if (extra.length) rows.push({ companyId, name: 'Managers & senior leads', roleKeys: ['manager', 'team_lead'], designationContains: 'Senior', items: extra.map((typeId) => ({ typeId, qty: 1 })), onPromotion: true, sortOrder: 10 });
    if (rows.length) await this.prisma.starterKitRule.createMany({ data: rows });
  }

  private async enabled(companyId: string) {
    const c = await this.prisma.company.findUnique({ where: { id: companyId }, select: { featuresVersion: true } });
    if (!c) return false;
    return (await this.entitlements.forCompany(companyId, c.featuresVersion)).features.has('ops.assets');
  }

  private async todayKey(companyId: string) {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    return localDateKey(new Date(), s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata');
  }
}

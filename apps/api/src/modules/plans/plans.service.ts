import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from '../access/entitlement.service';
import { CATALOG, CORE_FEATURES, FEATURE_BY_KEY, LIMIT_KEYS, LIMITS } from '../access/catalog';
import type { CompanyLimitsDto, FeatureOverrideDto, SavePlanDto } from './dto';

const PLAN_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  isActive: true,
  sortOrder: true,
  limits: true,
  updatedAt: true,
  features: { select: { featureKey: true } },
  _count: { select: { companies: true } },
} satisfies Prisma.PlanSelect;

type PlanRow = Prisma.PlanGetPayload<{ select: typeof PLAN_SELECT }>;

/**
 * Layer 1 administration (Super Admin): plans = bundles of catalog
 * features + limits; per-company overrides force a feature ON/OFF
 * (optionally until a date, e.g. trials) and override limits.
 * Every change bumps the affected companies' featuresVersion, so their
 * users' access refreshes on the next request.
 */
@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  // ─── Plans ────────────────────────────────────────────────

  async list() {
    const plans = await this.prisma.plan.findMany({ select: PLAN_SELECT, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    return plans.map((p) => this.presentPlan(p));
  }

  async get(id: string) {
    return this.presentPlan(await this.findPlan(id));
  }

  async create(dto: SavePlanDto) {
    const key = dto.key ?? this.slug(dto.name);
    await this.assertUnique(key, dto.name);
    const features = this.normalizeFeatures(dto.features);
    const count = await this.prisma.plan.count();
    const plan = await this.prisma.plan.create({
      data: {
        key,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        isActive: dto.isActive ?? true,
        sortOrder: count,
        limits: this.normalizeLimits(dto.limits ?? {}),
        features: { create: features.map((featureKey) => ({ featureKey })) },
      },
      select: { id: true },
    });
    return this.get(plan.id);
  }

  async update(id: string, dto: SavePlanDto) {
    const before = await this.findPlan(id);
    if (dto.name.trim() !== before.name) await this.assertUnique(undefined, dto.name, id);
    const features = this.normalizeFeatures(dto.features);
    // Archiving (isActive false) is allowed with companies on it: they keep the plan,
    // it just can't be chosen for new companies.
    const previous = new Set(before.features.map((f) => f.featureKey));

    await this.prisma.$transaction([
      this.prisma.planFeature.deleteMany({ where: { planId: id } }),
      this.prisma.planFeature.createMany({ data: features.map((featureKey) => ({ planId: id, featureKey })) }),
      this.prisma.plan.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() ?? before.description,
          isActive: dto.isActive ?? before.isActive,
          limits: dto.limits ? this.normalizeLimits(dto.limits) : (before.limits ?? Prisma.JsonNull),
        },
      }),
    ]);
    const affectedCompanies = await this.entitlements.bumpPlan(id);
    return {
      ...(await this.get(id)),
      changes: {
        added: features.filter((f) => !previous.has(f)),
        removed: [...previous].filter((f) => !features.includes(f)),
        affectedCompanies,
      },
    };
  }

  async remove(id: string) {
    const plan = await this.findPlan(id);
    if (plan._count.companies > 0) {
      throw new BadRequestException(`${plan._count.companies} compan${plan._count.companies === 1 ? 'y is' : 'ies are'} on this plan. Move them first.`);
    }
    await this.prisma.plan.delete({ where: { id } });
    return { id, name: plan.name, deleted: true };
  }

  // ─── Company entitlements ─────────────────────────────────

  /** Everything the Super Admin needs to see and change one company's features. */
  async describeCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        featuresVersion: true,
        limits: true,
        plan: { select: PLAN_SELECT },
        features: { orderBy: { updatedAt: 'desc' } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');

    const { features: effective, limits: effectiveLimits } = await this.entitlements.forCompany(companyId, company.featuresVersion);
    const planFeatures = new Set(company.plan?.features.map((f) => f.featureKey) ?? []);
    const overrides = new Map(company.features.map((o) => [o.featureKey, o]));
    const now = Date.now();

    const [employees, users] = await Promise.all([
      this.prisma.employee.count({ where: { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED } } }),
      this.prisma.user.count({ where: { companyId } }),
    ]);

    const planLimits = (company.plan?.limits ?? {}) as Record<string, number | null>;
    const companyLimits = (company.limits ?? {}) as Record<string, number | null>;

    return {
      company: { id: company.id, name: company.name },
      plan: company.plan ? this.presentPlan(company.plan) : null,
      modules: CATALOG.map((m) => ({
        key: m.key,
        label: m.label,
        features: m.features.map((f) => {
          const o = overrides.get(f.key);
          const expired = Boolean(o?.expiresAt && o.expiresAt.getTime() < now);
          const missing = (f.dependsOn ?? []).filter((d) => !effective.has(d));
          return {
            key: f.key,
            label: f.label,
            description: f.description,
            stage: f.stage,
            core: Boolean(f.core),
            dependsOn: f.dependsOn ?? [],
            inPlan: planFeatures.has(f.key),
            override: o
              ? { mode: o.mode, reason: o.reason, expiresAt: o.expiresAt, expired, updatedAt: o.updatedAt, setById: o.setById }
              : null,
            enabled: effective.has(f.key),
            blockedBy: missing,
          };
        }),
      })),
      limits: LIMITS.map((l) => ({
        ...l,
        plan: l.key in planLimits ? planLimits[l.key] : null,
        override: l.key in companyLimits ? companyLimits[l.key] : undefined,
        effective: l.key in effectiveLimits ? effectiveLimits[l.key] : null,
        usage: l.key === 'maxEmployees' ? employees : undefined,
      })),
      usage: { employees, users },
    };
  }

  async setCompanyPlan(companyId: string, planId: string) {
    await this.findCompany(companyId);
    const plan = await this.findPlan(planId);
    if (!plan.isActive) throw new BadRequestException(`The plan '${plan.name}' is archived`);
    await this.prisma.company.update({ where: { id: companyId }, data: { planId } });
    await this.entitlements.bump(companyId);
    return this.describeCompany(companyId);
  }

  async setOverride(companyId: string, featureKey: string, setById: string, dto: FeatureOverrideDto) {
    await this.findCompany(companyId);
    const feature = FEATURE_BY_KEY.get(featureKey);
    if (!feature) throw new NotFoundException(`Unknown feature '${featureKey}'`);
    if (feature.stage === 'coming_soon') throw new BadRequestException(`'${feature.label}' is not available yet`);
    if (feature.core && dto.mode === 'OFF') throw new BadRequestException(`'${feature.label}' is a core feature and can't be switched off`);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) throw new BadRequestException('The end date must be in the future');

    await this.prisma.companyFeature.upsert({
      where: { companyId_featureKey: { companyId, featureKey } },
      update: { mode: dto.mode, reason: dto.reason?.trim() || null, expiresAt, setById },
      create: { companyId, featureKey, mode: dto.mode, reason: dto.reason?.trim() || null, expiresAt, setById },
    });
    await this.entitlements.bump(companyId);
    return this.describeCompany(companyId);
  }

  async clearOverride(companyId: string, featureKey: string) {
    await this.findCompany(companyId);
    await this.prisma.companyFeature.deleteMany({ where: { companyId, featureKey } });
    await this.entitlements.bump(companyId);
    return this.describeCompany(companyId);
  }

  async setCompanyLimits(companyId: string, dto: CompanyLimitsDto) {
    await this.findCompany(companyId);
    const limits = this.normalizeLimits(dto.limits);
    await this.prisma.company.update({
      where: { id: companyId },
      data: { limits: Object.keys(limits).length ? limits : Prisma.JsonNull },
    });
    await this.entitlements.bump(companyId);
    return this.describeCompany(companyId);
  }

  // ─── Helpers ──────────────────────────────────────────────

  /** Known, available features; core features always included; dependencies added. */
  private normalizeFeatures(keys: string[]): string[] {
    const result = new Set<string>(CORE_FEATURES);
    const add = (key: string) => {
      const f = FEATURE_BY_KEY.get(key);
      if (!f) throw new BadRequestException(`Unknown feature '${key}'`);
      if (f.stage === 'coming_soon') throw new BadRequestException(`'${f.label}' is not available yet`);
      result.add(key);
      (f.dependsOn ?? []).forEach(add);
    };
    keys.forEach(add);
    return [...result];
  }

  private normalizeLimits(input: Record<string, unknown>): Record<string, number | null> {
    const out: Record<string, number | null> = {};
    for (const [key, value] of Object.entries(input)) {
      if (!LIMIT_KEYS.has(key)) throw new BadRequestException(`Unknown limit '${key}'`);
      if (value !== null && (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1_000_000)) {
        throw new BadRequestException(`Limit '${key}' must be a whole number (or null for unlimited)`);
      }
      out[key] = value as number | null;
    }
    return out;
  }

  private presentPlan(p: PlanRow) {
    return {
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      limits: (p.limits ?? {}) as Record<string, number | null>,
      features: p.features.map((f) => f.featureKey).sort(),
      companyCount: p._count.companies,
      updatedAt: p.updatedAt,
    };
  }

  private async findPlan(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id }, select: PLAN_SELECT });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  private async findCompany(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  private async assertUnique(key: string | undefined, name: string, exceptId?: string) {
    const clash = await this.prisma.plan.findFirst({
      where: {
        OR: [...(key ? [{ key }] : []), { name: { equals: name.trim(), mode: 'insensitive' as const } }],
        ...(exceptId && { NOT: { id: exceptId } }),
      },
      select: { key: true, name: true },
    });
    if (clash) throw new ConflictException(`A plan named '${clash.name}' already exists`);
  }

  private slug(name: string) {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'plan';
  }
}

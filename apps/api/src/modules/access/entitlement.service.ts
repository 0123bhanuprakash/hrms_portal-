import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AVAILABLE_FEATURES, CORE_FEATURES, FEATURE_BY_KEY } from './catalog';

export interface Entitlements {
  features: Set<string>;
  /** Merged limits, e.g. { maxEmployees: 50 } (null = unlimited) */
  limits: Record<string, number | null>;
  planKey: string | null;
}

/**
 * Layer 1 — which features a company may use.
 * Effective features = plan features ± per-company overrides (unexpired),
 * plus core features, minus anything whose dependencies are missing.
 * Cached per company@featuresVersion; any change bumps the version.
 */
@Injectable()
export class EntitlementService {
  private readonly cache = new Map<string, Entitlements>();

  constructor(private readonly prisma: PrismaService) {}

  /** Drops every cached company entitlement (they rebuild on the next request). */
  clearCaches(): void {
    this.cache.clear();
  }

  async forCompany(companyId: string, featuresVersion: number): Promise<Entitlements> {
    const cacheKey = `${companyId}@${featuresVersion}`;
    const hit = this.cache.get(cacheKey);
    if (hit) return hit;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        limits: true,
        plan: { select: { key: true, isActive: true, limits: true, features: { select: { featureKey: true } } } },
        features: true,
      },
    });

    const features = new Set<string>();
    const limits: Record<string, number | null> = {};
    const mergeLimits = (value: unknown) => {
      if (value && typeof value === 'object') Object.assign(limits, value as Record<string, number | null>);
    };

    // No plan yet (shouldn't happen after bootstrap) → everything available
    if (!company?.plan) AVAILABLE_FEATURES.forEach((f) => features.add(f));
    else {
      for (const pf of company.plan.features) features.add(pf.featureKey);
      mergeLimits(company.plan.limits);
    }
    // Company-level limit overrides win over the plan's
    mergeLimits(company?.limits);

    const now = Date.now();
    for (const override of company?.features ?? []) {
      if (override.expiresAt && override.expiresAt.getTime() < now) continue;
      if (override.mode === 'ON') features.add(override.featureKey);
      else features.delete(override.featureKey);
    }

    CORE_FEATURES.forEach((f) => features.add(f));

    // Unknown / coming-soon features never count; drop features whose dependencies are off
    for (const key of [...features]) {
      const feature = FEATURE_BY_KEY.get(key);
      if (!feature || feature.stage === 'coming_soon') features.delete(key);
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const key of [...features]) {
        if (FEATURE_BY_KEY.get(key)?.dependsOn?.some((d) => !features.has(d))) {
          features.delete(key);
          changed = true;
        }
      }
    }

    const result: Entitlements = { features, limits, planKey: company?.plan?.key ?? null };
    this.evict(companyId);
    this.cache.set(cacheKey, result);
    return result;
  }

  /** Call after changing a company's plan or overrides. */
  async bump(companyId: string): Promise<void> {
    await this.prisma.company.update({ where: { id: companyId }, data: { featuresVersion: { increment: 1 } } });
    this.evict(companyId);
  }

  /** Plan edited → every company on it refreshes on its next request. */
  async bumpPlan(planId: string): Promise<number> {
    const companies = await this.prisma.company.findMany({ where: { planId }, select: { id: true } });
    await this.prisma.company.updateMany({ where: { planId }, data: { featuresVersion: { increment: 1 } } });
    companies.forEach((c) => this.evict(c.id));
    return companies.length;
  }

  private evict(companyId: string) {
    for (const key of this.cache.keys()) if (key.startsWith(`${companyId}@`)) this.cache.delete(key);
  }
}

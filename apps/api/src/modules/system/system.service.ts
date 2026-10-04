import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from '../../health/health.service';
import { EmailService } from '../email/email.service';
import { EMAIL_QUEUE_NAME } from '../email/email.job.types';
import { AccessService } from '../access/access.service';
import { EntitlementService } from '../access/entitlement.service';
import { requestMetrics } from './request-metrics';
import { MaintenanceService, type MaintenanceSettings } from './maintenance.service';

const MINUTE = 60_000;
const DAY = 86_400_000;
const SAMPLE_EVERY_MS = 5 * MINUTE;
const PURGE_EVERY_MS = 6 * 60 * MINUTE;
const SERVICES = ['database', 'email', 'redis', 'elasticsearch'] as const;
type Service = (typeof SERVICES)[number];
type State = 'ok' | 'error' | 'disabled' | 'unverified';

const SERVICE_LABEL: Record<Service, string> = { database: 'Database', email: 'Email', redis: 'Redis', elasticsearch: 'Search' };
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export interface Incident {
  service: Service;
  label: string;
  from: string;
  to: string | null;
  minutes: number;
}

/**
 * Super Admin → System: health history (a check every 5 minutes), incidents,
 * traffic, database / storage / queue figures, the email log, readiness,
 * sign-in safety, maintenance mode and a few tools.
 */
@Injectable()
export class SystemService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemService.name);
  private timers: NodeJS.Timeout[] = [];
  private storageCache: { at: number; files: number; bytes: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly health: HealthService,
    private readonly email: EmailService,
    private readonly maintenance: MaintenanceService,
    private readonly access: AccessService,
    private readonly entitlements: EntitlementService,
    @Optional() @InjectQueue(EMAIL_QUEUE_NAME) private readonly emailQueue?: Queue,
  ) {}

  // ─── Background: samples, start event, clean-up ───────────

  onModuleInit() {
    if (process.env['SYSTEM_SAMPLING'] === 'off') return;
    void this.recordStart().catch((e: Error) => this.logger.warn(`Start event not recorded: ${e.message}`));
    const first = setTimeout(() => void this.sample().catch(() => undefined), 15_000);
    const every = setInterval(() => void this.sample().catch((e: Error) => this.logger.warn(`Health sample failed: ${e.message}`)), SAMPLE_EVERY_MS);
    const purge = setInterval(() => void this.purge().catch(() => undefined), PURGE_EVERY_MS);
    for (const t of [first, every, purge]) t.unref();
    this.timers.push(first, every, purge);
  }

  onModuleDestroy() {
    this.timers.forEach((t) => clearTimeout(t));
  }

  private version() {
    return process.env['npm_package_version'] ?? '0.0.1';
  }

  private async latestMigration() {
    const rows = await this.prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT migration_name, finished_at FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`;
    return rows[0] ?? null;
  }

  /** "API started", plus "Updated" when the version or the database changed since last time. */
  private async recordStart() {
    const migration = await this.latestMigration();
    const detail = `v${this.version()} · ${migration?.migration_name ?? 'no migrations'}`;
    const last = await this.prisma.systemEvent.findFirst({ where: { kind: 'started' }, orderBy: { at: 'desc' } });
    if (last?.detail && last.detail !== detail) {
      await this.prisma.systemEvent.create({ data: { kind: 'updated', title: `Updated to v${this.version()}`, detail: migration ? `Database: ${migration.migration_name}` : null } });
    }
    await this.prisma.systemEvent.create({ data: { kind: 'started', title: 'API started', detail } });
  }

  /** One health check for every service, saved for the history. */
  async sample() {
    const report = await this.health.check();
    const email = this.email.getStatus();
    const services: Record<Service, State> = {
      database: report.services.database,
      redis: report.services.redis,
      elasticsearch: report.services.elasticsearch,
      email: email.state,
    };
    const ok = !Object.values(services).includes('error');
    await this.prisma.systemHealthSample.create({ data: { ok, services, latency: report.latencyMs } });
    return { ok, services, latency: report.latencyMs, at: report.checkedAt };
  }

  private async purge() {
    const now = Date.now();
    await Promise.all([
      this.prisma.systemHealthSample.deleteMany({ where: { at: { lt: new Date(now - 90 * DAY) } } }),
      this.prisma.systemEvent.deleteMany({ where: { at: { lt: new Date(now - 180 * DAY) } } }),
      this.prisma.emailLog.deleteMany({ where: { createdAt: { lt: new Date(now - 30 * DAY) } } }),
      this.prisma.emailLog.updateMany({ where: { payload: { not: null }, createdAt: { lt: new Date(now - 7 * DAY) } }, data: { payload: null } }),
      this.prisma.signInAttempt.deleteMany({ where: { at: { lt: new Date(now - 30 * DAY) } } }),
    ]);
  }

  // ─── Health & speed ───────────────────────────────────────

  /** 90 days of daily uptime, the incidents found in the samples, and recent latency per service. */
  async healthHistory(now = new Date()) {
    const since = new Date(now.getTime() - 90 * DAY);
    const samples = await this.prisma.systemHealthSample.findMany({ where: { at: { gte: since } }, orderBy: { at: 'asc' }, select: { at: true, ok: true, services: true, latency: true } });
    const byDay = new Map<string, { total: number; ok: number }>();
    for (const s of samples) {
      const k = dayKey(s.at);
      const d = byDay.get(k) ?? { total: 0, ok: 0 };
      d.total++;
      if (s.ok) d.ok++;
      byDay.set(k, d);
    }
    const days = Array.from({ length: 90 }, (_, i) => {
      const k = dayKey(new Date(now.getTime() - (89 - i) * DAY));
      const d = byDay.get(k);
      return { day: k, checks: d?.total ?? 0, uptime: d ? Math.round((d.ok / d.total) * 1000) / 10 : null };
    });
    const okCount = samples.filter((s) => s.ok).length;
    const incidents = this.incidents(samples);
    const lastProblem = incidents[0]?.to ?? incidents[0]?.from ?? null;
    const recent = samples.slice(-12);
    const latency = Object.fromEntries(SERVICES.map((svc) => [svc, recent.map((s) => ((s.latency ?? {}) as Record<string, number>)[svc] ?? null).filter((v): v is number => v !== null)]));
    return {
      days,
      uptime: samples.length ? Math.round((okCount / samples.length) * 10000) / 100 : null,
      checks: samples.length,
      firstCheck: samples[0]?.at ?? null,
      lastProblem,
      incidents: incidents.slice(0, 20),
      latency,
    };
  }

  /** Runs of failed checks per service, newest first. */
  incidents(samples: Array<{ at: Date; services: unknown }>): Incident[] {
    const out: Incident[] = [];
    const open = new Map<Service, Date>();
    let prev: Date | null = null;
    for (const s of samples) {
      const services = (s.services ?? {}) as Record<string, State>;
      for (const svc of SERVICES) {
        const down = services[svc] === 'error';
        if (down && !open.has(svc)) open.set(svc, s.at);
        if (!down && open.has(svc)) {
          const from = open.get(svc)!;
          out.push({ service: svc, label: SERVICE_LABEL[svc], from: from.toISOString(), to: s.at.toISOString(), minutes: Math.max(1, Math.round((s.at.getTime() - from.getTime()) / MINUTE)) });
          open.delete(svc);
        }
      }
      prev = s.at;
    }
    for (const [svc, from] of open) {
      out.push({ service: svc, label: SERVICE_LABEL[svc], from: from.toISOString(), to: null, minutes: Math.max(1, Math.round(((prev ?? from).getTime() - from.getTime()) / MINUTE)) });
    }
    return out.sort((a, b) => b.from.localeCompare(a.from));
  }

  traffic() {
    return { ...requestMetrics.traffic(), slowest: requestMetrics.slowest(), recentErrors: requestMetrics.recentErrors() };
  }

  /** Timeline: incidents plus starts, updates, maintenance and tool use (last 30 days). */
  async timeline() {
    const since = new Date(Date.now() - 30 * DAY);
    const [events, samples] = await Promise.all([
      this.prisma.systemEvent.findMany({ where: { at: { gte: since } }, orderBy: { at: 'desc' }, take: 40 }),
      this.prisma.systemHealthSample.findMany({ where: { at: { gte: since } }, orderBy: { at: 'asc' }, select: { at: true, services: true } }),
    ]);
    const items = [
      ...events.map((e) => ({ at: e.at.toISOString(), kind: e.kind, title: e.title, detail: e.detail })),
      ...this.incidents(samples).map((i) => ({
        at: i.from,
        kind: i.to ? 'incident' : 'incident_open',
        title: i.to ? `${i.label} down for ${i.minutes} minute${i.minutes === 1 ? '' : 's'}` : `${i.label} is down`,
        detail: i.to ? `${new Date(i.from).toUTCString().slice(5, 22)} – ${new Date(i.to).toUTCString().slice(17, 22)} UTC` : `since ${new Date(i.from).toUTCString().slice(5, 22)} UTC`,
      })),
    ];
    // Back-to-back starts (dev reloads) collapse into the latest one
    const collapsed = items.sort((a, b) => b.at.localeCompare(a.at)).filter((e, i, all) => !(e.kind === 'started' && all[i - 1]?.kind === 'started'));
    return collapsed.slice(0, 30);
  }

  // ─── Data & delivery ──────────────────────────────────────

  async database() {
    const [version, size, conns, tables, migration] = await Promise.all([
      this.prisma.$queryRaw<Array<{ v: string }>>`SELECT current_setting('server_version') AS v`,
      this.prisma.$queryRaw<Array<{ bytes: bigint }>>`SELECT pg_database_size(current_database()) AS bytes`,
      this.prisma.$queryRaw<Array<{ used: bigint; max: string }>>`
        SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS used, current_setting('max_connections') AS max`,
      this.prisma.$queryRaw<Array<{ name: string; rows: number; bytes: bigint }>>`
        SELECT c.relname AS name, GREATEST(c.reltuples, 0)::float8 AS rows, pg_total_relation_size(c.oid) AS bytes
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname = current_schema() AND c.relname <> '_prisma_migrations'
        ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 6`,
      this.latestMigration(),
    ]);
    return {
      version: version[0]?.v ?? null,
      sizeBytes: Number(size[0]?.bytes ?? 0),
      connections: { used: Number(conns[0]?.used ?? 0), max: Number(conns[0]?.max ?? 0) },
      latestMigration: migration ? { name: migration.migration_name.replace(/^\d+_/, ''), appliedAt: migration.finished_at } : null,
      tables: tables.map((t) => ({ name: t.name, rows: Math.round(Number(t.rows)), bytes: Number(t.bytes) })),
    };
  }

  private async walk(dir: string): Promise<{ files: number; bytes: number }> {
    let files = 0;
    let bytes = 0;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const sub = await this.walk(full);
        files += sub.files;
        bytes += sub.bytes;
      } else if (e.isFile()) {
        files++;
        bytes += (await fs.stat(full).catch(() => null))?.size ?? 0;
      }
    }
    return { files, bytes };
  }

  async storage() {
    const driver = this.config.get<string>('storage.driver') ?? 'local';
    const uploads = path.resolve(this.config.get<string>('storage.uploadsDir') ?? 'uploads');
    const privateDir = path.resolve(this.config.get<string>('storage.privateDir') ?? 'private-files');
    let disk: { files: number; bytes: number } | null = null;
    let free: { freeBytes: number; totalBytes: number } | null = null;
    if (driver === 'local') {
      if (!this.storageCache || Date.now() - this.storageCache.at > 5 * MINUTE) {
        const [a, b] = await Promise.all([this.walk(uploads), this.walk(privateDir)]);
        this.storageCache = { at: Date.now(), files: a.files + b.files, bytes: a.bytes + b.bytes };
      }
      disk = { files: this.storageCache.files, bytes: this.storageCache.bytes };
      const st = await fs.statfs(uploads).catch(() => fs.statfs(process.cwd()).catch(() => null));
      if (st) free = { freeBytes: st.bavail * st.bsize, totalBytes: st.blocks * st.bsize };
    }
    const weekAgo = new Date(Date.now() - 7 * DAY);
    const [byCompany, week] = await Promise.all([
      this.prisma.$queryRaw<Array<{ company_id: string; name: string; bytes: bigint; files: bigint }>>`
        SELECT f.company_id, c.name, SUM(f.size)::bigint AS bytes, COUNT(*)::bigint AS files FROM (
          SELECT company_id, size_bytes AS size FROM employee_documents
          UNION ALL SELECT ec.company_id, ei.receipt_size FROM expense_items ei JOIN expense_claims ec ON ec.id = ei.claim_id WHERE ei.receipt_size IS NOT NULL
          UNION ALL SELECT company_id, file_size FROM ticket_messages WHERE file_size IS NOT NULL
        ) f JOIN companies c ON c.id = f.company_id
        GROUP BY f.company_id, c.name ORDER BY bytes DESC LIMIT 6`,
      this.prisma.$queryRaw<Array<{ bytes: bigint | null }>>`
        SELECT SUM(size)::bigint AS bytes FROM (
          SELECT size_bytes AS size FROM employee_documents WHERE created_at >= ${weekAgo}
          UNION ALL SELECT receipt_size FROM expense_items WHERE receipt_size IS NOT NULL AND created_at >= ${weekAgo}
          UNION ALL SELECT file_size FROM ticket_messages WHERE file_size IS NOT NULL AND created_at >= ${weekAgo}
        ) w`,
    ]);
    return {
      driver,
      files: disk?.files ?? null,
      bytes: disk?.bytes ?? null,
      disk: free,
      addedThisWeekBytes: Number(week[0]?.bytes ?? 0),
      byCompany: byCompany.map((r) => ({ id: r.company_id, name: r.name, bytes: Number(r.bytes), files: Number(r.files) })),
    };
  }

  async queue() {
    if (!this.emailQueue) return { enabled: false as const, counts: null };
    try {
      const c = await this.emailQueue.getJobCounts('waiting', 'active', 'failed', 'completed', 'delayed');
      return { enabled: true as const, counts: { waiting: (c['waiting'] ?? 0) + (c['delayed'] ?? 0), active: c['active'] ?? 0, failed: c['failed'] ?? 0, completed: c['completed'] ?? 0 } };
    } catch {
      return { enabled: true as const, counts: null };
    }
  }

  async emails(query: { status?: 'SENT' | 'FAILED'; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 10));
    const startOfDay = new Date(new Date().toISOString().slice(0, 10));
    const where = query.status ? { status: query.status } : {};
    const [rows, total, sentToday, failedToday, failedWeek, avg] = await Promise.all([
      this.prisma.emailLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, select: { id: true, to: true, subject: true, status: true, error: true, provider: true, durationMs: true, createdAt: true, retriedAt: true, payload: true, companyId: true } }),
      this.prisma.emailLog.count({ where }),
      this.prisma.emailLog.count({ where: { status: 'SENT', createdAt: { gte: startOfDay } } }),
      this.prisma.emailLog.count({ where: { status: 'FAILED', createdAt: { gte: startOfDay } } }),
      this.prisma.emailLog.count({ where: { status: 'FAILED', createdAt: { gte: new Date(Date.now() - 7 * DAY) } } }),
      this.prisma.emailLog.aggregate({ where: { status: 'SENT', createdAt: { gte: startOfDay } }, _avg: { durationMs: true } }),
    ]);
    const companyIds = [...new Set(rows.map((r) => r.companyId).filter((v): v is string => Boolean(v)))];
    const companies = companyIds.length ? await this.prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }) : [];
    const names = new Map(companies.map((c) => [c.id, c.name]));
    return {
      stats: { sentToday, failedToday, failedWeek, avgMs: Math.round(avg._avg.durationMs ?? 0) },
      data: rows.map(({ payload, companyId, ...r }) => ({ ...r, company: companyId ? { id: companyId, name: names.get(companyId) ?? null } : null, canRetry: r.status === 'FAILED' && Boolean(payload) })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async retryEmail(id: string) {
    const row = await this.prisma.emailLog.findUnique({ where: { id }, select: { id: true, status: true, payload: true, to: true } });
    if (!row) throw new NotFoundException('Email not found');
    if (row.status !== 'FAILED' || !row.payload) throw new BadRequestException('This email can no longer be retried');
    try {
      await this.email.retry(id);
    } catch (e) {
      throw new BadRequestException(`Sending failed again: ${(e as Error).message}`);
    }
    return { id, to: row.to, retried: true };
  }

  // ─── Readiness, safety, maintenance, tools ────────────────

  readiness() {
    const env = (this.config.get<string>('nodeEnv') ?? 'development').toLowerCase();
    const jwt = this.config.get<string>('jwt.secret') ?? '';
    const refresh = this.config.get<string>('jwt.refreshSecret') ?? '';
    const provider = this.config.get<string>('email.provider') ?? 'console';
    const cors = this.config.get<string[]>('corsOrigins') ?? [];
    const checks = [
      {
        key: 'secrets',
        ok: jwt.length >= 32 && refresh.length >= 32 && jwt !== refresh && Boolean(process.env['PII_ENCRYPTION_KEY']),
        level: 'bad',
        title: 'Strong secrets',
        okText: 'Sign-in secrets are long and separate; the personal-data key is set',
        fix: 'Set JWT_SECRET and JWT_REFRESH_SECRET to two different random values of 32+ characters, and PII_ENCRYPTION_KEY.',
      },
      {
        key: 'email',
        ok: provider !== 'console',
        level: 'bad',
        title: 'Real email provider',
        okText: `Emails are delivered (${provider})`,
        fix: 'EMAIL_PROVIDER is “console”, so nobody receives invites or password resets. Set it to smtp, gmail or resend.',
      },
      {
        key: 'production',
        ok: env === 'production',
        level: 'bad',
        title: 'Running in production mode',
        okText: 'NODE_ENV is production',
        fix: `NODE_ENV is “${env}”: slower, more logging, and detailed error messages. Set NODE_ENV=production.`,
      },
      {
        key: 'redis',
        ok: Boolean(this.config.get<string>('redis.url')),
        level: 'warn',
        title: 'Redis for the email queue',
        okText: 'Emails are queued and retried up to 5 times',
        fix: 'Without Redis, emails are sent while the person waits and a failed one isn’t tried again. Add REDIS_URL.',
      },
      {
        key: 'storage',
        ok: (this.config.get<string>('storage.driver') ?? 'local') !== 'local',
        level: 'warn',
        title: 'Files on durable storage',
        okText: 'Uploads are in object storage',
        fix: 'Uploads are on this server’s disk and are lost if the server is replaced. Set STORAGE_DRIVER=s3.',
      },
      {
        key: 'cors',
        ok: !cors.includes('*'),
        level: 'warn',
        title: 'Only your web address can call the API',
        okText: `Allowed: ${cors.join(', ')}`,
        fix: 'CORS_ORIGINS allows every website. List only your web address.',
      },
    ];
    return { done: checks.filter((c) => c.ok).length, total: checks.length, checks: checks.map(({ okText, fix, ...c }) => ({ ...c, detail: c.ok ? okText : fix })) };
  }

  async signIns(now = new Date()) {
    const since = new Date(now.getTime() - DAY);
    const [ok, failed, locked] = await Promise.all([
      this.prisma.signInAttempt.count({ where: { at: { gte: since }, success: true } }),
      this.prisma.signInAttempt.count({ where: { at: { gte: since }, success: false } }),
      this.prisma.user.findMany({
        where: { lockedUntil: { gt: now } },
        orderBy: { lockedUntil: 'desc' },
        take: 20,
        select: { id: true, email: true, firstName: true, lastName: true, lockedUntil: true, loginAttempts: true, company: { select: { id: true, name: true } } },
      }),
    ]);
    return { successful: ok, failed, locked };
  }

  async unlock(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({ where: { id: userId }, data: { loginAttempts: 0, lockedUntil: null } });
    return { id: user.id, email: user.email, unlocked: true };
  }

  getMaintenance() {
    return this.maintenance.get();
  }

  async setMaintenance(input: Partial<MaintenanceSettings>, userId: string) {
    const before = await this.maintenance.get();
    const after = await this.maintenance.set(input, userId);
    if (before.enabled !== after.enabled) {
      await this.prisma.systemEvent.create({
        data: after.enabled ? { kind: 'maintenance_on', title: 'Maintenance mode on', detail: after.title } : { kind: 'maintenance_off', title: 'Maintenance mode off' },
      });
    }
    return after;
  }

  async clearCaches() {
    this.access.clearCaches();
    this.entitlements.clearCaches();
    this.storageCache = null;
    await this.prisma.systemEvent.create({ data: { kind: 'caches_cleared', title: 'Access caches cleared' } });
    return { cleared: true };
  }

  /** Runs every check now (email included) and saves it to the history. */
  async checkNow() {
    await this.email.verifyConnection();
    return this.sample();
  }

  /** For support: versions, settings without secrets, readiness, recent errors and incidents. */
  async diagnostics() {
    const [health, db, migration] = await Promise.all([this.healthHistory(), this.database(), this.latestMigration()]);
    const t = requestMetrics.traffic();
    return {
      generatedAt: new Date().toISOString(),
      api: { version: this.version(), node: process.version, environment: this.config.get<string>('nodeEnv'), uptimeSeconds: Math.floor(process.uptime()), platform: process.platform },
      database: { version: db.version, sizeBytes: db.sizeBytes, connections: db.connections, latestMigration: migration?.migration_name ?? null },
      settings: {
        emailProvider: this.config.get<string>('email.provider'),
        storageDriver: this.config.get<string>('storage.driver'),
        queue: Boolean(this.config.get<string>('redis.url')),
        search: Boolean(this.config.get<string>('elasticsearch.url')),
        corsOrigins: this.config.get<string[]>('corsOrigins'),
        trustProxy: process.env['TRUST_PROXY'] ?? null,
      },
      readiness: this.readiness(),
      health: { uptime90d: health.uptime, incidents: health.incidents },
      traffic: { lastHour: t.lastHour, since: t.since },
      slowest: requestMetrics.slowest(),
      recentErrors: requestMetrics.recentErrors(),
    };
  }
}

// ============================================================
// Request metrics, kept in memory on this API server (they reset on
// restart): requests per minute for the last hour, response times,
// the slowest endpoints, recent server errors, and who was active in
// the last 15 minutes. Cheap enough to record on every request.
// ============================================================

const MINUTE = 60_000;
const WINDOW_MINUTES = 60;
const SAMPLES_PER_ROUTE = 200;
const MAX_ROUTES = 500;
const ACTIVE_WINDOW_MS = 15 * MINUTE;

interface MinuteBucket {
  minute: number;
  count: number;
  clientErrors: number;
  serverErrors: number;
  /** Durations (ms) of this minute's requests, capped */
  durations: number[];
}

interface RouteStats {
  method: string;
  route: string;
  count: number;
  serverErrors: number;
  /** Most recent durations (ring) */
  recent: number[];
  next: number;
}

export interface RecentError {
  at: string;
  method: string;
  route: string;
  status: number;
  ms: number;
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

/** "/api/v1/employees/3f2c…/documents" → "/api/v1/employees/:id/documents" (when the matched route is unknown). */
export function normalizePath(url: string): string {
  const path = url.split('?')[0] ?? url;
  return path
    .split('/')
    .map((seg) => (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(seg) || /^\d+$/.test(seg) ? ':id' : seg))
    .join('/');
}

export class RequestMetrics {
  private buckets: MinuteBucket[] = [];
  private routes = new Map<string, RouteStats>();
  private errors: RecentError[] = [];
  private active = new Map<string, { at: number; companyId: string | null }>();
  readonly startedAt = Date.now();

  record(method: string, route: string, status: number, ms: number, user?: { id: string; companyId: string | null } | null, now = Date.now()) {
    const minute = Math.floor(now / MINUTE);
    let bucket = this.buckets[this.buckets.length - 1];
    if (!bucket || bucket.minute !== minute) {
      bucket = { minute, count: 0, clientErrors: 0, serverErrors: 0, durations: [] };
      this.buckets.push(bucket);
      const oldest = minute - WINDOW_MINUTES + 1;
      while (this.buckets.length && this.buckets[0]!.minute < oldest) this.buckets.shift();
    }
    bucket.count++;
    if (status >= 500) bucket.serverErrors++;
    else if (status >= 400) bucket.clientErrors++;
    if (bucket.durations.length < 5000) bucket.durations.push(ms);

    const key = `${method} ${route}`;
    let stats = this.routes.get(key);
    if (!stats) {
      if (this.routes.size >= MAX_ROUTES) return this.touch(user, now);
      stats = { method, route, count: 0, serverErrors: 0, recent: [], next: 0 };
      this.routes.set(key, stats);
    }
    stats.count++;
    if (status >= 500) stats.serverErrors++;
    if (stats.recent.length < SAMPLES_PER_ROUTE) stats.recent.push(ms);
    else {
      stats.recent[stats.next] = ms;
      stats.next = (stats.next + 1) % SAMPLES_PER_ROUTE;
    }

    if (status >= 500) {
      this.errors.unshift({ at: new Date(now).toISOString(), method, route, status, ms });
      this.errors.length = Math.min(this.errors.length, 20);
    }
    this.touch(user, now);
  }

  private touch(user: { id: string; companyId: string | null } | null | undefined, now: number) {
    if (!user) return;
    this.active.set(user.id, { at: now, companyId: user.companyId });
    if (this.active.size > 50_000) this.prune(now);
  }

  private prune(now: number) {
    for (const [id, v] of this.active) if (now - v.at > ACTIVE_WINDOW_MS) this.active.delete(id);
  }

  /** Requests and p95 per minute for the last hour (oldest first; empty minutes included). */
  traffic(now = Date.now()) {
    const current = Math.floor(now / MINUTE);
    const byMinute = new Map(this.buckets.map((b) => [b.minute, b]));
    const minutes = Array.from({ length: WINDOW_MINUTES }, (_, i) => {
      const m = current - WINDOW_MINUTES + 1 + i;
      const b = byMinute.get(m);
      return { at: new Date(m * MINUTE).toISOString(), requests: b?.count ?? 0, p95: b ? percentile(b.durations, 95) : 0, errors: b?.serverErrors ?? 0 };
    });
    const live = this.buckets.filter((b) => b.minute > current - WINDOW_MINUTES);
    const all = live.flatMap((b) => b.durations);
    const total = live.reduce((s, b) => s + b.count, 0);
    const server = live.reduce((s, b) => s + b.serverErrors, 0);
    const client = live.reduce((s, b) => s + b.clientErrors, 0);
    this.prune(now);
    const companies = new Set([...this.active.values()].map((v) => v.companyId).filter(Boolean));
    return {
      since: new Date(this.startedAt).toISOString(),
      minutes,
      lastHour: {
        requests: total,
        perMinute: Math.round(total / WINDOW_MINUTES),
        p95: percentile(all, 95),
        p50: percentile(all, 50),
        serverErrors: server,
        clientErrors: client,
        errorRate: total ? Math.round((server / total) * 1000) / 10 : 0,
      },
      activeUsers: this.active.size,
      activeCompanies: companies.size,
    };
  }

  /** Slowest endpoints by p95 (only ones called at least `minCalls` times). */
  slowest(limit = 8, minCalls = 3) {
    return [...this.routes.values()]
      .filter((r) => r.count >= minCalls)
      .map((r) => ({ method: r.method, route: r.route, calls: r.count, p95: percentile(r.recent, 95), p50: percentile(r.recent, 50), serverErrors: r.serverErrors }))
      .sort((a, b) => b.p95 - a.p95)
      .slice(0, limit);
  }

  recentErrors() {
    return [...this.errors];
  }
}

/** One per API process. */
export const requestMetrics = new RequestMetrics();

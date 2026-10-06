import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

export interface MaintenanceSettings {
  /** Company users are paused right now */
  enabled: boolean;
  title: string;
  message: string;
  /** Planned window (shown in the notice) */
  startsAt: string | null;
  endsAt: string | null;
  /** Show the notice to company users before the window starts */
  announce: boolean;
}

export const DEFAULT_MAINTENANCE: MaintenanceSettings = {
  enabled: false,
  title: 'Scheduled maintenance',
  message: 'HRMS is being upgraded. Please try again in a little while.',
  startsAt: null,
  endsAt: null,
  announce: false,
};

const KEY = 'maintenance';
const TTL_MS = 10_000;

/**
 * Maintenance mode (Super Admin → System). While on, company users get a
 * "paused" notice instead of the app; Super Admins carry on. Read on every
 * request, so it's cached for a few seconds.
 */
@Injectable()
export class MaintenanceService {
  private cached: { at: number; value: MaintenanceSettings } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async get(): Promise<MaintenanceSettings> {
    if (this.cached && Date.now() - this.cached.at < TTL_MS) return this.cached.value;
    const row = await this.prisma.platformSetting.findUnique({ where: { key: KEY } });
    const value = { ...DEFAULT_MAINTENANCE, ...((row?.value ?? {}) as Partial<MaintenanceSettings>) };
    this.cached = { at: Date.now(), value };
    return value;
  }

  async set(input: Partial<MaintenanceSettings>, userId: string): Promise<MaintenanceSettings> {
    // Only the fields that were sent (validated DTOs carry the rest as undefined)
    const sent = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<MaintenanceSettings>;
    const next = { ...(await this.get()), ...sent };
    next.title = next.title.trim() || DEFAULT_MAINTENANCE.title;
    next.message = next.message.trim() || DEFAULT_MAINTENANCE.message;
    if (next.startsAt && next.endsAt && new Date(next.endsAt) <= new Date(next.startsAt)) {
      throw new BadRequestException('The end must be after the start');
    }
    await this.prisma.platformSetting.upsert({
      where: { key: KEY },
      update: { value: next as unknown as Prisma.InputJsonObject, updatedById: userId },
      create: { key: KEY, value: next as unknown as Prisma.InputJsonObject, updatedById: userId },
    });
    this.cached = { at: Date.now(), value: next };
    // Every open tab re-checks the pause notice at once
    this.realtime.broadcast('system');
    return next;
  }

  /** What company users should see: the pause, or a notice ahead of a planned window. */
  async publicStatus(now = new Date()) {
    const m = await this.get();
    const ended = m.endsAt ? new Date(m.endsAt) <= now : false;
    return {
      paused: m.enabled ? { title: m.title, message: m.message, endsAt: m.endsAt } : null,
      notice: !m.enabled && m.announce && m.startsAt && !ended ? { title: m.title, message: m.message, startsAt: m.startsAt, endsAt: m.endsAt } : null,
    };
  }

  /** Throws the "paused" error for a company user while maintenance is on. */
  async assertOpenFor(user: { isSuperAdmin: boolean }) {
    if (user.isSuperAdmin) return;
    const m = await this.get();
    if (m.enabled) throw new ServiceUnavailableException({ message: m.message, code: 'maintenance' });
  }
}

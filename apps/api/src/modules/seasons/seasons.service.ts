import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DECORATIONS, nextPresetDates, PRESET_BY_KEY, SEASON_PRESETS, shiftYear } from './presets';
import type { SaveSeasonDto, UpdateSeasonDto } from './dto';

const MAX_DAYS = 31;
const SELECT = {
  id: true,
  preset: true,
  name: true,
  emoji: true,
  startsOn: true,
  endsOn: true,
  everyYear: true,
  colors: true,
  decoration: true,
  greeting: true,
  onSignIn: true,
  enabled: true,
  updatedAt: true,
} satisfies Prisma.SeasonalThemeSelect;
type Row = Prisma.SeasonalThemeGetPayload<{ select: typeof SELECT }>;

const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * Seasonal themes: a festival look (colours, a decoration, a greeting) that
 * switches on for the whole company on the first day and back by itself after
 * the last day (company time zone). "Every year" seasons roll to next year's
 * dates once they end.
 */
@Injectable()
export class SeasonsService {
  constructor(private readonly prisma: PrismaService) {}

  async todayKey(companyId: string): Promise<string> {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    return new Intl.DateTimeFormat('en-CA', { timeZone: s?.timezone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  /** Ready-made national seasons with their next dates. */
  async presets(companyId: string) {
    const today = await this.todayKey(companyId);
    const planned = new Set((await this.prisma.seasonalTheme.findMany({ where: { companyId, preset: { not: null } }, select: { preset: true } })).map((r) => r.preset));
    return SEASON_PRESETS.map((p) => {
      const next = nextPresetDates(p, today);
      return {
        key: p.key,
        name: p.name,
        emoji: p.emoji,
        colors: p.colors,
        decoration: p.decoration,
        greeting: p.greeting,
        startsOn: next?.[0] ?? null,
        endsOn: next?.[1] ?? null,
        planned: planned.has(p.key),
      };
    });
  }

  /** The company's seasons (rolled to their next dates) + suggestions from the holiday list. */
  async list(companyId: string) {
    const today = await this.todayKey(companyId);
    const rows = await this.rolled(companyId, today);
    const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 75 * 86_400_000);
    const holidays = await this.prisma.publicHoliday.findMany({
      where: { companyId, date: { gte: new Date(`${today}T00:00:00Z`), lte: soon } },
      select: { name: true, date: true },
      orderBy: { date: 'asc' },
    });
    const taken = new Set(rows.filter((r) => r.preset).map((r) => r.preset));
    const suggestions: Array<{ preset: string; name: string; emoji: string; holiday: string; startsOn: string; endsOn: string }> = [];
    for (const h of holidays) {
      const p = SEASON_PRESETS.find((x) => x.matches.some((m) => h.name.toLowerCase().includes(m)));
      if (!p || taken.has(p.key)) continue;
      const next = nextPresetDates(p, today);
      if (!next) continue;
      taken.add(p.key);
      suggestions.push({ preset: p.key, name: p.name, emoji: p.emoji, holiday: h.name, startsOn: next[0], endsOn: next[1] });
    }
    return { today, seasons: rows.map((r) => this.present(r, today)), suggestions };
  }

  /** What is on today (any signed-in user; also used for the sign-in page). */
  async active(companyId: string) {
    const today = await this.todayKey(companyId);
    const rows = await this.rolled(companyId, today);
    const on = rows.find((r) => r.enabled && r.startsOn <= today && today <= r.endsOn);
    return on ? this.present(on, today) : null;
  }

  async create(companyId: string, userId: string, dto: SaveSeasonDto) {
    const data = this.validate(dto);
    await this.assertFree(companyId, data.startsOn, data.endsOn, data.enabled);
    const row = await this.prisma.seasonalTheme.create({ data: { companyId, createdById: userId, ...data }, select: SELECT });
    return this.present(row, await this.todayKey(companyId));
  }

  async update(companyId: string, id: string, dto: UpdateSeasonDto) {
    const current = await this.find(companyId, id);
    const data = this.validate({
      preset: current.preset ?? undefined,
      name: current.name,
      emoji: current.emoji,
      startsOn: current.startsOn,
      endsOn: current.endsOn,
      everyYear: current.everyYear,
      colors: current.colors as unknown as SaveSeasonDto['colors'],
      decoration: current.decoration,
      greeting: current.greeting ?? undefined,
      onSignIn: current.onSignIn,
      enabled: current.enabled,
      ...dto,
    } as SaveSeasonDto);
    await this.assertFree(companyId, data.startsOn, data.endsOn, data.enabled, id);
    const row = await this.prisma.seasonalTheme.update({ where: { id }, data, select: SELECT });
    return this.present(row, await this.todayKey(companyId));
  }

  async remove(companyId: string, id: string) {
    await this.find(companyId, id);
    await this.prisma.seasonalTheme.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ─── Helpers ──────────────────────────────────────────────

  /** Seasons sorted by date; "every year" ones that ended move to next year's dates. */
  private async rolled(companyId: string, today: string): Promise<Row[]> {
    const rows = await this.prisma.seasonalTheme.findMany({ where: { companyId }, select: SELECT, orderBy: { startsOn: 'asc' } });
    for (const r of rows) {
      if (!r.everyYear || r.endsOn >= today) continue;
      let [a, b] = [r.startsOn, r.endsOn];
      for (let i = 0; i < 5 && b < today; i++) [a, b] = shiftYear(r.preset ? PRESET_BY_KEY.get(r.preset) : undefined, a, b);
      await this.prisma.seasonalTheme.update({ where: { id: r.id }, data: { startsOn: a, endsOn: b } });
      r.startsOn = a;
      r.endsOn = b;
    }
    return rows.sort((x, y) => x.startsOn.localeCompare(y.startsOn));
  }

  private validate(dto: SaveSeasonDto) {
    if (dto.preset && !PRESET_BY_KEY.has(dto.preset)) throw new BadRequestException('Unknown ready-made season');
    if (dto.endsOn < dto.startsOn) throw new BadRequestException('The last day must be on or after the first day');
    if (days(dto.startsOn, dto.endsOn) + 1 > MAX_DAYS) throw new BadRequestException(`A season can last at most ${MAX_DAYS} days`);
    if (!DECORATIONS.includes(dto.decoration as never)) throw new BadRequestException('Unknown decoration');
    return {
      preset: dto.preset ?? null,
      name: dto.name.trim(),
      emoji: dto.emoji.trim(),
      startsOn: dto.startsOn,
      endsOn: dto.endsOn,
      everyYear: dto.everyYear ?? true,
      colors: { main: dto.colors.main.toUpperCase(), accent: dto.colors.accent.toUpperCase(), deep: dto.colors.deep.toUpperCase() },
      decoration: dto.decoration,
      greeting: dto.greeting?.trim() || null,
      onSignIn: dto.onSignIn ?? true,
      enabled: dto.enabled ?? true,
    };
  }

  /** Two switched-on seasons can't share a day (everyone sees one look at a time). */
  private async assertFree(companyId: string, startsOn: string, endsOn: string, enabled: boolean, exceptId?: string) {
    if (!enabled) return;
    const clash = await this.prisma.seasonalTheme.findFirst({
      where: { companyId, enabled: true, startsOn: { lte: endsOn }, endsOn: { gte: startsOn }, ...(exceptId && { NOT: { id: exceptId } }) },
      select: { name: true, startsOn: true, endsOn: true },
    });
    if (clash) throw new ConflictException(`These dates overlap “${clash.name}” (${clash.startsOn} → ${clash.endsOn}). Change the dates or switch one off.`);
  }

  private async find(companyId: string, id: string) {
    const row = await this.prisma.seasonalTheme.findFirst({ where: { id, companyId }, select: SELECT });
    if (!row) throw new NotFoundException('Season not found');
    return row;
  }

  private present(r: Row, today: string) {
    const live = r.enabled && r.startsOn <= today && today <= r.endsOn;
    return {
      ...r,
      status: !r.enabled ? 'off' : live ? 'live' : r.endsOn < today ? 'ended' : 'upcoming',
      startsInDays: days(today, r.startsOn),
      daysLeft: live ? days(today, r.endsOn) + 1 : null,
    };
  }
}

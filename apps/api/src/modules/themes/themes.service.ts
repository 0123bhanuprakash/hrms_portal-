import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Theme } from '@prisma/client';
import type { CustomTheme, PlatformThemeSettings, ThemeRef, ThemeTokens } from '@hrms/types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateThemeInput, UpdateThemeInput, UpdateThemeSettingsInput } from './theme.schema';

const SETTING_KEYS = ['superAdminTheme', 'defaultCompanyTheme'] as const;
type SettingKey = (typeof SETTING_KEYS)[number];

/** Used until a Super Admin picks something else. */
const DEFAULT_REF: ThemeRef = { kind: 'preset', key: 'indigo' };

// ============================================================
// ThemesService — platform theme library + theme assignments.
// Built-in presets live in the web app (code); this service stores
// custom themes and which theme each scope uses.
// ============================================================

@Injectable()
export class ThemesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Custom themes ─────────────────────────────────────────

  async list(): Promise<CustomTheme[]> {
    const rows = await this.prisma.theme.findMany({ orderBy: { updatedAt: 'desc' } });
    return rows.map(toDto);
  }

  async get(id: string): Promise<CustomTheme> {
    return toDto(await this.find(id));
  }

  async create(input: CreateThemeInput, userId: string): Promise<CustomTheme> {
    await this.assertNameFree(input.name);
    const row = await this.prisma.theme.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        tokens: input.tokens as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    });
    return toDto(row);
  }

  async update(id: string, input: UpdateThemeInput): Promise<CustomTheme> {
    const existing = await this.find(id);
    if (input.name && input.name !== existing.name) await this.assertNameFree(input.name);

    const row = await this.prisma.theme.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.tokens && { tokens: input.tokens as unknown as Prisma.InputJsonValue }),
      },
    });
    return toDto(row);
  }

  /** Themes in use (Super Admin portal or company default) cannot be deleted. */
  async remove(id: string): Promise<{ id: string; name: string }> {
    const theme = await this.find(id);
    const settings = await this.getSettings();
    const usedBy = SETTING_KEYS.filter((k) => {
      const ref = settings[k];
      return ref.kind === 'custom' && ref.id === id;
    });
    if (usedBy.length) {
      throw new ConflictException(
        `“${theme.name}” is in use (${usedBy.map(describeKey).join(', ')}). Choose another theme there first.`,
      );
    }
    await this.prisma.theme.delete({ where: { id } });
    return { id, name: theme.name };
  }

  // ─── Assignments ───────────────────────────────────────────

  async getSettings(): Promise<PlatformThemeSettings> {
    const rows = await this.prisma.platformSetting.findMany({ where: { key: { in: [...SETTING_KEYS] } } });
    const byKey = new Map(rows.map((r) => [r.key, r.value as unknown as ThemeRef]));
    return {
      superAdminTheme: byKey.get('superAdminTheme') ?? DEFAULT_REF,
      defaultCompanyTheme: byKey.get('defaultCompanyTheme') ?? DEFAULT_REF,
    };
  }

  /**
   * Settings plus the tokens of any referenced custom theme, so a client can
   * render the active theme with one request (presets resolve client-side).
   */
  async getSettingsResolved(): Promise<PlatformThemeSettings & { customTokens: Record<string, ThemeTokens> }> {
    const settings = await this.getSettings();
    const ids = SETTING_KEYS.map((k) => settings[k]).flatMap((r) => (r.kind === 'custom' ? [r.id] : []));
    const themes = ids.length ? await this.prisma.theme.findMany({ where: { id: { in: ids } } }) : [];
    return {
      ...settings,
      customTokens: Object.fromEntries(themes.map((t) => [t.id, t.tokens as unknown as ThemeTokens])),
    };
  }

  async updateSettings(input: UpdateThemeSettingsInput, userId: string) {
    for (const key of SETTING_KEYS) {
      const ref = input[key];
      if (!ref) continue;
      if (ref.kind === 'custom') await this.find(ref.id);
      await this.prisma.platformSetting.upsert({
        where: { key },
        create: { key, value: ref as unknown as Prisma.InputJsonValue, updatedById: userId },
        update: { value: ref as unknown as Prisma.InputJsonValue, updatedById: userId },
      });
    }
    return this.getSettingsResolved();
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async find(id: string): Promise<Theme> {
    const theme = await this.prisma.theme.findUnique({ where: { id } });
    if (!theme) throw new NotFoundException(`Theme '${id}' not found`);
    return theme;
  }

  private async assertNameFree(name: string): Promise<void> {
    const clash = await this.prisma.theme.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    if (clash) throw new ConflictException(`A theme named “${name}” already exists`);
  }
}

function toDto(row: Theme): CustomTheme {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    tokens: row.tokens as unknown as ThemeTokens,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function describeKey(key: SettingKey): string {
  return key === 'superAdminTheme' ? 'Super Admin portal' : 'default for new companies';
}

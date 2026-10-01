import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ThemeRef, ThemeTokens } from '@hrms/types';
import { themeRefSchema, themeTokensSchema } from './theme.schema';

// ============================================================
// Company theme = a snapshot of ThemeTokens stored on CompanyBranding
// (plus the library theme it came from). Snapshots keep a company's
// look stable even if the library theme is later edited or deleted,
// and let Company Admins customise their own copy.
// ============================================================

export interface CompanyThemeInput {
  themeTokens?: unknown;
  themeSource?: unknown;
}

export interface CompanyThemeFields {
  themeTokens?: Prisma.InputJsonValue;
  themeSource?: Prisma.InputJsonValue;
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * Validates an optional company theme from a request body.
 * Returns Prisma branding fields to write, or `{}` when no theme was sent.
 * The legacy primary/secondary colors (emails, logo fallback) follow the theme.
 */
export function companyThemeFields(input: CompanyThemeInput): CompanyThemeFields {
  if (input.themeTokens === undefined) {
    if (input.themeSource !== undefined) {
      throw new BadRequestException({ message: ['themeSource requires themeTokens'], error: 'Bad Request' });
    }
    return {};
  }

  const tokens = themeTokensSchema.safeParse(input.themeTokens);
  if (!tokens.success) {
    throw new BadRequestException({
      message: tokens.error.errors.map((e) => `themeTokens.${e.path.join('.')} ${e.message}`),
      error: 'Bad Request',
    });
  }

  let source: ThemeRef | null = null;
  if (input.themeSource !== undefined && input.themeSource !== null) {
    const parsed = themeRefSchema.safeParse(input.themeSource);
    if (!parsed.success) {
      throw new BadRequestException({ message: ['themeSource must be a valid theme reference'], error: 'Bad Request' });
    }
    source = parsed.data;
  }

  const t: ThemeTokens = tokens.data;
  return {
    themeTokens: t as unknown as Prisma.InputJsonValue,
    themeSource: (source ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
    primaryColor: t.light.primary,
    secondaryColor: t.light.sidebarActive,
  };
}

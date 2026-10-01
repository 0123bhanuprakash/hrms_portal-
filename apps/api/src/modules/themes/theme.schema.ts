import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import type { ThemePalette, ThemeRef, ThemeTokens } from '@hrms/types';

// ============================================================
// Runtime validation for theme payloads.
// Typed against the ThemeTokens contract in @hrms/types so the
// API and the web editor cannot drift apart silently.
// Strict: unknown keys are rejected, colors must be #RRGGBB.
// ============================================================

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #4F46E5');

const palette: z.ZodType<ThemePalette> = z
  .object({
    background: hex,
    surface: hex,
    foreground: hex,
    mutedForeground: hex,
    border: hex,
    primary: hex,
    primaryForeground: hex,
    sidebar: hex,
    sidebarForeground: hex,
    sidebarActive: hex,
    success: hex,
    warning: hex,
    danger: hex,
    info: hex,
  })
  .strict();

export const themeTokensSchema: z.ZodType<ThemeTokens> = z
  .object({
    version: z.literal(1),
    light: palette,
    dark: palette,
    typography: z
      .object({
        font: z.enum(['inter', 'plus-jakarta-sans', 'manrope', 'dm-sans', 'ibm-plex-sans', 'system']),
        scale: z.enum(['sm', 'md', 'lg']),
      })
      .strict(),
    shape: z
      .object({
        radius: z.number().int().min(0).max(20),
        shadow: z.enum(['flat', 'soft', 'elevated']),
      })
      .strict(),
    layout: z.object({ density: z.enum(['compact', 'comfortable']) }).strict(),
  })
  .strict();

export const themeRefSchema: z.ZodType<ThemeRef> = z.union([
  z.object({ kind: z.literal('preset'), key: z.string().regex(/^[a-z0-9-]{1,40}$/) }).strict(),
  z.object({ kind: z.literal('custom'), id: z.string().uuid() }).strict(),
]);

const name = z.string().trim().min(1, 'Name is required').max(60);
const description = z.string().trim().max(200).nullish();

export const createThemeSchema = z.object({ name, description, tokens: themeTokensSchema }).strict();
export const updateThemeSchema = z
  .object({ name: name.optional(), description, tokens: themeTokensSchema.optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export const updateThemeSettingsSchema = z
  .object({ superAdminTheme: themeRefSchema.optional(), defaultCompanyTheme: themeRefSchema.optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export type CreateThemeInput = z.infer<typeof createThemeSchema>;
export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;
export type UpdateThemeSettingsInput = z.infer<typeof updateThemeSettingsSchema>;

/**
 * Validates a request body with a zod schema. Errors are returned in the
 * same `{ field: [messages] }` shape as class-validator failures.
 */
export class ZodBody<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const messages = result.error.errors.map((e) => `${e.path.join('.') || 'body'} ${e.message}`);
    throw new BadRequestException({ message: messages, error: 'Bad Request' });
  }
}

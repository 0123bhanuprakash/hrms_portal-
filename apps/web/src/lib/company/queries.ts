'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BackdropLevel, BackdropPack, CompanyPersonalization, MenuStyle, ThemeRef, ThemeTokens } from '@hrms/types';
import { api } from '@/lib/api';
import { resolveTheme } from '@/lib/theme/presets';
import type { DensityPref, TextSizePref } from '@/lib/preferences/display';

// ============================================================
// Company portal data hooks (tenant-scoped endpoints).
// ============================================================

export interface CompanyThemeResponse {
  themeTokens: ThemeTokens | null;
  themeSource: ThemeRef | null;
  /** Present when the company has no theme of its own yet */
  platformDefault: { ref: ThemeRef; tokens: ThemeTokens | null } | null;
  /** What employees may change for themselves */
  personalization?: CompanyPersonalization;
  /** Company defaults for view settings (chart styles…) */
  uiDefaults?: Record<string, unknown>;
}

export interface CompanyBrandingResponse {
  displayName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  /** Short line under the name in the side menu */
  tagline?: string | null;
  /** Logo for dark mode */
  logoDarkUrl?: string | null;
  signInMessage?: string | null;
  signInBackground?: 'pack' | 'photo' | 'plain';
  signInPhotoUrl?: string | null;
}

export interface CompanyStats {
  userCount: number;
  employeeCount: number;
  departmentCount: number;
  activeUserCount: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  dateFormat: string;
  notificationsEnabled?: boolean;
  emailNotifications?: boolean;
  density?: DensityPref;
  textSize?: TextSizePref;
  reduceMotion?: boolean;
  /** Built-in theme key; null = the company theme */
  colorTheme?: string | null;
  /** null = the company default */
  menuStyle?: MenuStyle | null;
  /** Page background pack; null = the company default */
  backdropPack?: BackdropPack | null;
  /** lively | calm | off; null = the company default */
  backdropLevel?: BackdropLevel | null;
  /** View settings that follow the person (see lib/preferences/ui-state) */
  uiState?: Record<string, unknown>;
  /** Super Admins: email when a new device signs in */
  notifyNewDevice?: boolean;
  /** Sign out after this many idle minutes (null = never) */
  idleTimeoutMinutes?: number | null;
  /** Super Admins: confirm the password before risky changes */
  reauthForRisky?: boolean;
  /** Per topic: { time: { app, email } } — missing = on */
  notificationTopics?: Record<string, { app?: boolean; email?: boolean }>;
  /** Quiet hours for emails */
  quietHours?: { on: boolean; from: string; to: string; weekends: boolean } | null;
  /** One summary email a day */
  dailySummary?: boolean;
}

export const companyKeys = {
  theme: (id: string) => ['company', id, 'theme'] as const,
  branding: (id: string) => ['company', id, 'branding'] as const,
  stats: (id: string) => ['company', id, 'stats'] as const,
  preferences: ['me', 'preferences'] as const,
};

async function unwrap<T>(request: Promise<{ data: { data: T } }>): Promise<T> {
  return (await request).data.data;
}

/** The tokens a company portal should render: own theme, else the platform default. */
export function companyThemeTokens(data: CompanyThemeResponse | undefined): ThemeTokens | null {
  if (!data) return null;
  if (data.themeTokens) return data.themeTokens;
  if (data.platformDefault) {
    const { ref, tokens } = data.platformDefault;
    return tokens ?? resolveTheme(ref);
  }
  return resolveTheme(undefined);
}

export function useCompanyTheme(companyId: string | null | undefined) {
  return useQuery({
    queryKey: companyKeys.theme(companyId ?? ''),
    queryFn: () => unwrap<CompanyThemeResponse>(api.get(`/companies/${companyId}/theme`)),
    enabled: Boolean(companyId),
    staleTime: 60_000,
  });
}

export function useUpdateCompanyTheme(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { themeTokens: ThemeTokens; themeSource?: ThemeRef }) =>
      unwrap<CompanyThemeResponse>(api.put(`/companies/${companyId}/theme`, body)),
    onSuccess: (data) => qc.setQueryData(companyKeys.theme(companyId), data),
  });
}

/** Company Admins decide what employees may personalise. */
export function useUpdatePersonalization(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CompanyPersonalization>) =>
      unwrap<CompanyPersonalization>(api.put(`/companies/${companyId}/personalization`, body)),
    onSuccess: (personalization) =>
      qc.setQueryData<CompanyThemeResponse>(companyKeys.theme(companyId), (old) => (old ? { ...old, personalization } : old)),
  });
}

export function useCompanyBranding(companyId: string | null | undefined) {
  return useQuery({
    queryKey: companyKeys.branding(companyId ?? ''),
    queryFn: () => unwrap<CompanyBrandingResponse>(api.get(`/companies/${companyId}/branding`)),
    enabled: Boolean(companyId),
    staleTime: 60_000,
  });
}

export function useUpdateCompanyBranding(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<{ displayName: string; tagline: string; signInMessage: string; signInBackground: 'pack' | 'photo' | 'plain'; logoUrl: string | null; logoDarkUrl: string | null; signInPhotoUrl: string | null }>) =>
      unwrap<CompanyBrandingResponse>(api.patch(`/companies/${companyId}/branding`, body)),
    onSuccess: (data) => qc.setQueryData(companyKeys.branding(companyId), data),
  });
}

export function useUploadBrandingAsset(companyId: string, kind: 'logo' | 'favicon' | 'logo-dark' | 'sign-in-photo') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return unwrap<CompanyBrandingResponse>(
        api.post(`/companies/${companyId}/branding/${kind}`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
      );
    },
    onSuccess: (data) => qc.setQueryData(companyKeys.branding(companyId), data),
  });
}

export function useCompanyStats(companyId: string | null | undefined) {
  return useQuery({
    queryKey: companyKeys.stats(companyId ?? ''),
    queryFn: () => unwrap<CompanyStats>(api.get(`/companies/${companyId}/stats`)),
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: companyKeys.preferences,
    queryFn: () => unwrap<UserPreferences>(api.get('/users/me/preferences')),
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<UserPreferences>) => unwrap<UserPreferences>(api.patch('/users/me/preferences', body)),
    onSuccess: (data) => qc.setQueryData(companyKeys.preferences, data),
  });
}

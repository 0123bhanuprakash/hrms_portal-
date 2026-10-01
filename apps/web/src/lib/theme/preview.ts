import type { ThemeTokens } from '@hrms/types';

/** Pages the Theme Studio preview iframe can show. */
export type PreviewPage = 'dashboard' | 'people' | 'form';

/** Message posted from the Theme Studio to the /theme-preview iframe. */
export interface PreviewMessage {
  type: 'hrms-theme-preview';
  tokens: ThemeTokens;
  mode: 'light' | 'dark';
  page: PreviewPage;
  /** Shown in the mock portal header (defaults to "Acme Corp") */
  companyName?: string;
}

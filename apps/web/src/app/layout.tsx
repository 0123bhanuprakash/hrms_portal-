import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './motion.css';
import './emoji-motion.css';
import './backdrops.css';
import './backdrop-packs.css';
import './season.css';
import { AppProviders } from '@/providers/app-providers';
import { DISPLAY_BOOT_SCRIPT } from '@/lib/preferences/display';

const sans = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'HRMS Portal — Multi-Tenant Management Platform',
  description: 'Full-featured enterprise HRMS SaaS portal',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <head>
        {/* Applies the user's display settings before first paint (no size flash) */}
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

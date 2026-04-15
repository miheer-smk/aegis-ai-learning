import type { Metadata } from 'next';
import { Syne, DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AEGIS — Agentic AI Learning Platform',
  description:
    'An agentic AI learning system that models how students think, not just what they answer. Features epistemic state modeling, temporal memory decay, and cognitive DNA adaptation.',
  keywords: ['AI tutor', 'learning', 'epistemic', 'Socratic method', 'knowledge graph'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${dmSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="bg-bg-primary text-content antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}

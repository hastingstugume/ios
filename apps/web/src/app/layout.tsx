import type { Metadata } from 'next';
import { DM_Mono, Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-geist-sans' });
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-dm-mono' });
const syne = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-syne' });

export const metadata: Metadata = {
  title: 'Internet Opportunity Scanner — Find B2B buying signals in real time',
  description: 'Discover real buying intent and demand signals from Reddit, RSS feeds, and developer communities.',
  openGraph: {
    title: 'Internet Opportunity Scanner',
    description: 'Continuously scan the internet for high-confidence B2B buying signals.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${dmMono.variable} ${syne.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import Providers from '@/components/Providers';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import UsernameModal from '@/components/wallet/UsernameModal';
import DisplayPreferenceModal from '@/components/wallet/DisplayPreferenceModal';
import ToastContainer from '@/components/ui/Toast';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '8-Bit Arcade | Play Retro Games, Earn Crypto',
  description:
    'Play classic arcade games, compete on leaderboards, and earn 8BIT tokens. Powered by Arbitrum.',
  keywords: [
    '8-bit',
    'arcade',
    'retro games',
    'crypto gaming',
    'play to earn',
    'arbitrum',
    'blockchain games',
  ],
  authors: [{ name: '8-Bit Arcade' }],
  openGraph: {
    title: '8-Bit Arcade',
    description: 'Play retro games, earn crypto rewards',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: '8-Bit Arcade',
    description: 'Play retro games, earn crypto rewards',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#00ff41',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-arcade-black text-white antialiased">
        <Providers>
          {/* CRT Scanline Effect */}
          <div className="crt-overlay" aria-hidden="true" />

          {/* Main Layout */}
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />

          {/* Modals */}
          <UsernameModal />
          <DisplayPreferenceModal />

          {/* Toast Notifications */}
          <ToastContainer />
        </Providers>
      </body>
    </html>
  );
}

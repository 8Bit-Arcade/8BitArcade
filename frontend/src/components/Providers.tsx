'use client';

import { ReactNode, useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import WalletProvider from '@/components/wallet/WalletProvider';
import AudioManager from '@/components/audio/AudioManager';

import '@rainbow-me/rainbowkit/styles.css';

// Custom RainbowKit theme to match arcade aesthetic
const arcadeTheme = darkTheme({
  accentColor: '#00ff41', // arcade-green
  accentColorForeground: '#0a0a0a', // arcade-black
  borderRadius: 'small',
  fontStack: 'system',
  overlayBlur: 'small',
});

// Customize the theme further
const customTheme = {
  ...arcadeTheme,
  colors: {
    ...arcadeTheme.colors,
    modalBackground: '#1a1a2e', // arcade-dark
    modalBorder: '#00ff4130', // arcade-green with opacity
    profileForeground: '#1a1a2e',
    closeButton: '#00ff41',
    closeButtonBackground: '#00ff4120',
    connectButtonBackground: '#00ff41',
    connectButtonBackgroundError: '#ff0040',
    connectButtonInnerBackground: '#1a1a2e',
    connectButtonText: '#0a0a0a',
    connectButtonTextError: '#ffffff',
  },
  fonts: {
    body: '"VT323", monospace',
  },
};

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Handle hydration
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customTheme} modalSize="compact">
          <AudioManager>
            <WalletProvider>
              {mounted ? children : null}
            </WalletProvider>
          </AudioManager>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

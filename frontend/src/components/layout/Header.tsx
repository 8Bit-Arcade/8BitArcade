'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import AudioControls from '@/components/audio/AudioControls';
import { useDisplayName } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { truncateAddress } from '@/lib/utils';
import { USE_TESTNET } from '@/config/contracts';

export default function Header() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const displayName = useDisplayName(address);
  const { setDisplayPreferenceModalOpen } = useUIStore();

  const navLinks = [
    { href: '/', label: 'Games' },
    { href: '/leaderboard', label: 'Ranks' },
    { href: '/tournaments', label: 'Tourneys' },
    ...(USE_TESTNET ? [{ href: '/faucet', label: 'Faucet' }] : []),
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 bg-arcade-black/95 backdrop-blur border-b border-arcade-green/30">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo - Links to Homepage */}
          <a
            href="https://8bitarcade.games"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 group"
          >
            <span className="font-pixel text-lg md:text-xl text-arcade-green group-hover:glow-green transition-all">
              8-BIT
            </span>
            <span className="font-pixel text-lg md:text-xl text-arcade-cyan group-hover:glow-cyan transition-all">
              ARCADE
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  font-pixel text-xs uppercase tracking-wider transition-all
                  ${
                    isActive(link.href)
                      ? 'text-arcade-green glow-green'
                      : 'text-gray-400 hover:text-arcade-green'
                  }
                `}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Side - Audio + Wallet */}
          <div className="flex items-center gap-4">
            <AudioControls />

            {/* Wallet Connect */}
            <div className="hidden sm:block">
              <ConnectButton.Custom>
                {({
                  account,
                  chain,
                  openAccountModal,
                  openChainModal,
                  openConnectModal,
                  mounted,
                }) => {
                  const ready = mounted;
                  const connected = ready && account && chain;

                  return (
                    <div
                      {...(!ready && {
                        'aria-hidden': true,
                        style: {
                          opacity: 0,
                          pointerEvents: 'none',
                          userSelect: 'none',
                        },
                      })}
                    >
                      {(() => {
                        if (!connected) {
                          return (
                            <button
                              onClick={openConnectModal}
                              className="btn-arcade text-xs"
                            >
                              Connect
                            </button>
                          );
                        }

                        if (chain.unsupported) {
                          return (
                            <button
                              onClick={openChainModal}
                              className="btn-arcade-danger text-xs"
                            >
                              Wrong Network
                            </button>
                          );
                        }

                        return (
                          <button
                            onClick={openAccountModal}
                            className="btn-arcade text-xs flex items-center gap-2"
                          >
                            <span className="w-2 h-2 bg-arcade-green rounded-full animate-pulse" />
                            {displayName || truncateAddress(account.address)}
                          </button>
                        );
                      })()}
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>

            {/* Display Settings Button (when connected) */}
            {isConnected && (
              <button
                onClick={() => setDisplayPreferenceModalOpen(true)}
                className="hidden sm:flex items-center justify-center w-8 h-8 rounded border border-arcade-green/30 text-arcade-green hover:bg-arcade-green/10 transition-all"
                title="Display Settings"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            )}

            {/* Mobile Menu Button */}
            <button className="md:hidden text-arcade-green p-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex items-center justify-center gap-4 mt-3 pt-3 border-t border-arcade-green/20">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`
                font-pixel text-xs uppercase tracking-wider transition-all
                ${
                  isActive(link.href)
                    ? 'text-arcade-green'
                    : 'text-gray-400 hover:text-arcade-green'
                }
              `}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

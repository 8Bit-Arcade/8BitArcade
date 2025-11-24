'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import AudioControls from '@/components/audio/AudioControls';
import { useAuthStore } from '@/stores/authStore';
import { truncateAddress } from '@/lib/utils';

export default function Header() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { getUsername } = useAuthStore();
  const username = address ? getUsername(address) : null;

  const navLinks = [
    { href: '/', label: 'Games' },
    { href: '/leaderboard', label: 'Ranks' },
    { href: '/tournaments', label: 'Tourneys' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 bg-arcade-black/95 backdrop-blur border-b border-arcade-green/30">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-pixel text-lg md:text-xl text-arcade-green group-hover:glow-green transition-all">
              8-BIT
            </span>
            <span className="font-pixel text-lg md:text-xl text-arcade-cyan group-hover:glow-cyan transition-all">
              ARCADE
            </span>
          </Link>

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
                            {username || truncateAddress(account.address)}
                          </button>
                        );
                      })()}
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>

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

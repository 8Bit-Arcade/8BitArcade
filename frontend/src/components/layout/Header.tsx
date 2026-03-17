'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import AudioControls from '@/components/audio/AudioControls';
import { useDisplayName } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { truncateAddress } from '@/lib/utils';

type SubItem = { href: string; label: string; icon: string };
type NavItem =
  | { href: string; label: string; children?: never }
  | { href: string; label: string; children: SubItem[] };

const navItems: NavItem[] = [
  { href: '/', label: 'Games' },
  { href: '/leaderboard', label: 'Ranks' },
  { href: '/blitz', label: 'Blitz' },
  {
    href: '/multiplayer',
    label: 'PVP',
    children: [
      { href: '/multiplayer',    label: 'Arena 1v1',  icon: '⚔️' },
      { href: '/blitz/brackets', label: 'Tourneys',   icon: '🏆' },
    ],
  },
  { href: '/nft', label: 'NFT' },
  { href: 'https://8bitarcade.games/sale.html', label: 'Token Sale' },
  { href: '/airdrop', label: 'Airdrop' },
];

export default function Header() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const displayName = useDisplayName(address);
  const { setDisplayPreferenceModalOpen } = useUIStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (item: NavItem) => {
    if (item.href === '/') return pathname === '/';
    if (item.children?.some(c => pathname?.startsWith(c.href.split('?')[0]))) return true;
    return pathname?.startsWith(item.href.split('?')[0]);
  };

  return (
    <header className="sticky top-0 z-40 bg-arcade-black/95 backdrop-blur border-b border-arcade-green/30">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">

          {/* Logo */}
          <a
            href="https://8bitarcade.games"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 group shrink-0"
          >
            <span className="font-pixel text-lg md:text-xl text-arcade-green group-hover:glow-green transition-all">
              8-BIT
            </span>
            <span className="font-pixel text-lg md:text-xl text-arcade-cyan group-hover:glow-cyan transition-all">
              ARCADE
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-5">
            {navItems.map((item) =>
              item.children ? (
                // ── Dropdown item ─────────────────────────────────────────
                <div key={item.label} className="relative group">
                  <button
                    className={`font-pixel text-xs uppercase tracking-wider transition-all flex items-center gap-1
                      ${isActive(item) ? 'text-arcade-green glow-green' : 'text-gray-400 hover:text-arcade-green'}`}
                  >
                    {item.label}
                    <svg className="w-2.5 h-2.5 mt-0.5 opacity-60" fill="currentColor" viewBox="0 0 10 6">
                      <path d="M0 0l5 6 5-6z" />
                    </svg>
                  </button>

                  {/* Dropdown panel — appears on hover */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2
                                  invisible opacity-0 group-hover:visible group-hover:opacity-100
                                  transition-all duration-150 min-w-[160px]">
                    <div className="bg-arcade-black border border-arcade-green/40 rounded shadow-xl shadow-black/60 py-1">
                      {item.children.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={`flex items-center gap-2 px-3 py-2 font-pixel text-xs uppercase tracking-wider
                            whitespace-nowrap transition-colors
                            ${pathname?.startsWith(sub.href.split('?')[0])
                              ? 'text-arcade-green bg-arcade-green/10'
                              : 'text-gray-400 hover:text-arcade-green hover:bg-arcade-green/5'}`}
                        >
                          <span>{sub.icon}</span>
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                // ── Plain link ────────────────────────────────────────────
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-pixel text-xs uppercase tracking-wider transition-all
                    ${isActive(item) ? 'text-arcade-green glow-green' : 'text-gray-400 hover:text-arcade-green'}`}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          {/* Right side — audio + wallet + settings + hamburger */}
          <div className="flex items-center gap-3">
            <AudioControls />

            {/* Wallet */}
            <div className="hidden sm:block">
              <ConnectButton.Custom>
                {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                  const ready = mounted;
                  const connected = ready && account && chain;
                  return (
                    <div {...(!ready && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' } })}>
                      {(() => {
                        if (!connected) return (
                          <button onClick={openConnectModal} className="btn-arcade text-xs">Connect</button>
                        );
                        if (chain.unsupported) return (
                          <button onClick={openChainModal} className="btn-arcade-danger text-xs">Wrong Network</button>
                        );
                        return (
                          <button onClick={openAccountModal} className="btn-arcade text-xs flex items-center gap-2">
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

            {/* Display settings */}
            {isConnected && (
              <button
                onClick={() => setDisplayPreferenceModalOpen(true)}
                className="hidden sm:flex items-center justify-center w-8 h-8 rounded border border-arcade-green/30
                           text-arcade-green hover:bg-arcade-green/10 transition-all"
                title="Display Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}

            {/* Hamburger (mobile) */}
            <button
              className="md:hidden text-arcade-green p-1"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation (slide-down) */}
        {mobileOpen && (
          <nav className="md:hidden mt-3 pt-3 border-t border-arcade-green/20 flex flex-col gap-0.5">
            {navItems.map((item) =>
              item.children ? (
                <div key={item.label}>
                  {/* Section label */}
                  <div className={`font-pixel text-xs uppercase tracking-wider px-2 py-2
                    ${isActive(item) ? 'text-arcade-green' : 'text-gray-500'}`}>
                    {item.label}
                  </div>
                  {/* Sub-items indented */}
                  <div className="ml-3 flex flex-col gap-0.5 mb-1">
                    {item.children.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded font-pixel text-xs uppercase tracking-wider transition-colors
                          ${pathname?.startsWith(sub.href.split('?')[0])
                            ? 'text-arcade-green bg-arcade-green/10'
                            : 'text-gray-400 hover:text-arcade-green hover:bg-arcade-green/5'}`}
                      >
                        <span>{sub.icon}</span>
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`font-pixel text-xs uppercase tracking-wider px-2 py-2 rounded transition-colors
                    ${isActive(item)
                      ? 'text-arcade-green'
                      : 'text-gray-400 hover:text-arcade-green'}`}
                >
                  {item.label}
                </Link>
              )
            )}

            {/* Wallet connect in mobile menu */}
            <div className="mt-2 pt-2 border-t border-arcade-green/10">
              <ConnectButton.Custom>
                {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                  const ready = mounted;
                  const connected = ready && account && chain;
                  return (
                    <div {...(!ready && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none' } })}>
                      {!connected
                        ? <button onClick={openConnectModal} className="btn-arcade text-xs w-full">Connect Wallet</button>
                        : chain.unsupported
                          ? <button onClick={openChainModal} className="btn-arcade-danger text-xs w-full">Wrong Network</button>
                          : <button onClick={openAccountModal} className="btn-arcade text-xs w-full flex items-center justify-center gap-2">
                              <span className="w-2 h-2 bg-arcade-green rounded-full animate-pulse" />
                              {displayName || truncateAddress(account.address)}
                            </button>
                      }
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

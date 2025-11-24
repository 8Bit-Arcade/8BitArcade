'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-arcade-dark border-t border-arcade-green/30 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Copyright */}
          <div className="flex items-center gap-2">
            <span className="font-pixel text-sm text-arcade-green">8-BIT</span>
            <span className="font-pixel text-sm text-arcade-cyan">ARCADE</span>
            <span className="font-arcade text-gray-500 ml-2">
              &copy; {new Date().getFullYear()}
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <Link
              href="/about"
              className="font-arcade text-sm text-gray-400 hover:text-arcade-green transition-colors"
            >
              About
            </Link>
            <Link
              href="/docs"
              className="font-arcade text-sm text-gray-400 hover:text-arcade-green transition-colors"
            >
              Docs
            </Link>
            <a
              href="https://twitter.com/8BitArcade"
              target="_blank"
              rel="noopener noreferrer"
              className="font-arcade text-sm text-gray-400 hover:text-arcade-cyan transition-colors"
            >
              Twitter
            </a>
            <a
              href="https://discord.gg/8BitArcade"
              target="_blank"
              rel="noopener noreferrer"
              className="font-arcade text-sm text-gray-400 hover:text-arcade-pink transition-colors"
            >
              Discord
            </a>
          </div>

          {/* Network Status */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-arcade-green rounded-full animate-pulse" />
            <span className="font-arcade text-xs text-gray-500">
              Arbitrum One
            </span>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center font-arcade text-xs text-gray-600 mt-4">
          Play responsibly. Token rewards are subject to availability.
        </p>
      </div>
    </footer>
  );
}

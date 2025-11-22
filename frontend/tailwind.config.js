/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 8-bit arcade color palette
        'arcade-black': '#0a0a0a',
        'arcade-dark': '#1a1a2e',
        'arcade-purple': '#16213e',
        'arcade-blue': '#0f3460',
        'arcade-green': '#00ff41',
        'arcade-cyan': '#00f5ff',
        'arcade-pink': '#ff00ff',
        'arcade-yellow': '#ffff00',
        'arcade-orange': '#ff6600',
        'arcade-red': '#ff0040',
      },
      fontFamily: {
        'pixel': ['"Press Start 2P"', 'cursive'],
        'arcade': ['"VT323"', 'monospace'],
      },
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scanline': 'scanline 8s linear infinite',
        'blink': 'blink 1s step-end infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': {
            boxShadow: '0 0 5px currentColor, 0 0 10px currentColor',
            opacity: '1'
          },
          '50%': {
            boxShadow: '0 0 20px currentColor, 0 0 30px currentColor',
            opacity: '0.8'
          },
        },
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(0, 255, 65, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 65, 0.1) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '20px 20px',
      },
    },
  },
  plugins: [],
}

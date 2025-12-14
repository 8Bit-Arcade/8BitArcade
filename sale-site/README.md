# 8-Bit Arcade Token Sale Website

A standalone HTML/CSS/JavaScript website for the 8BIT token sale, separate from the game application.

## 🎨 Features

- **Landing Page** (`index.html`)
  - Hero section with stats
  - About section with features
  - Tokenomics visualization
  - Tournament tier breakdown
  - Roadmap timeline
  - FAQ section
  - Call-to-action sections

- **Token Sale Page** (`sale.html`)
  - Web3 wallet integration
  - Real-time sale statistics
  - ETH and USDC payment support
  - Live progress tracking
  - Token calculator
  - User purchase history

## 🚀 Quick Start

### 1. Configuration

Update the contract addresses in `js/sale.js`:

```javascript
const CONTRACTS = {
    TOKEN_SALE: '0x...', // YOUR TokenSale contract address
    EIGHT_BIT_TOKEN: '0x...', // YOUR 8BIT token address
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum One USDC
    CHAIN_ID: 42161, // Arbitrum One
    CHAIN_NAME: 'Arbitrum One'
};
```

### 2. Update Links

Update these links throughout the site:
- `https://play.8bitarcade.games` → Your game app URL
- `https://docs.8bitarcade.games` → Your GitBook/docs URL
- Discord, Twitter, Telegram links in footer

### 3. Deploy

#### Option A: Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd sale-site
vercel
```

#### Option B: Netlify
1. Drag and drop the `sale-site` folder to [Netlify Drop](https://app.netlify.com/drop)
2. Or use Netlify CLI:
```bash
npm i -g netlify-cli
cd sale-site
netlify deploy --prod
```

#### Option C: GitHub Pages
1. Create a new repo or branch
2. Push the `sale-site` contents
3. Enable GitHub Pages in repo settings

## 📁 File Structure

```
sale-site/
├── index.html          # Landing page
├── sale.html           # Token sale page
├── css/
│   └── styles.css      # 8-bit themed styles
├── js/
│   ├── main.js         # Landing page JS
│   └── sale.js         # Web3 sale integration
└── README.md           # This file
```

## 🎨 Customization

### Colors

Edit CSS variables in `css/styles.css`:

```css
:root {
    --color-dark: #0a0e27;
    --color-purple: #8b5cf6;
    --color-pink: #ff00ff;
    --color-cyan: #00d4ff;
    --color-green: #00ff88;
    --color-yellow: #ffff00;
}
```

### Fonts

The site uses:
- **Press Start 2P** (pixel font) - from Google Fonts
- **Arial** (fallback)

### Content

Update these sections in `index.html`:
- Hero stats
- About cards
- Tokenomics numbers
- Roadmap phases
- FAQ items
- Social links

## 🔧 Technical Details

### Web3 Integration

- Uses **ethers.js v5** (loaded from CDN)
- Supports MetaMask, WalletConnect, Coinbase Wallet
- Built for **Arbitrum One** (Layer 2)
- Automatic network switching

### Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive
- Web3 wallet required for purchasing

## 🌐 Domain Setup

### Recommended Structure

- **Main site**: `8bitarcade.games` or `8bitarcade.io` (this sale site)
- **Game app**: `play.8bitarcade.games` or `app.8bitarcade.games`
- **Docs**: `docs.8bitarcade.games` (GitBook)

### DNS Configuration

Point your domain to your hosting provider:

**Vercel:**
```
A     @    76.76.21.21
CNAME play play.8bitarcade.games.cdn.vercel-dns.com
```

**Netlify:**
```
A     @    75.2.60.5
CNAME play your-app-name.netlify.app
```

## 📦 Dependencies

No build step required! All dependencies loaded from CDN:
- ethers.js (Web3)
- Google Fonts (Press Start 2P)

## 🔒 Security

- All token sale logic handled by smart contracts
- No backend database
- No user data storage
- Client-side only

## 📝 Before Launch Checklist

- [ ] Update contract addresses in `js/sale.js`
- [ ] Test wallet connection on Arbitrum
- [ ] Verify sale contract integration
- [ ] Update all social links
- [ ] Test on mobile devices
- [ ] Add Google Analytics (optional)
- [ ] Set up custom domain
- [ ] SSL certificate enabled
- [ ] Test both ETH and USDC purchases
- [ ] Verify progress tracking works

## 🚀 Post-Deployment

1. **Test thoroughly** on testnet first
2. **Deploy contracts** to Arbitrum mainnet
3. **Update contract addresses** in `sale.js`
4. **Redeploy** the site
5. **Announce** to community

## 🐛 Troubleshooting

**Wallet won't connect:**
- Check browser console for errors
- Verify network ID matches (42161 for Arbitrum One)
- Try refreshing page

**Can't buy tokens:**
- Ensure wallet has ETH/USDC
- Check contract addresses are correct
- Verify sale is active

**Progress not updating:**
- Check contract deployment
- Verify RPC endpoint is working
- Check browser console for errors

## 📄 License

MIT License - feel free to customize!

## 🔗 Links

- **Game App**: [play.8bitarcade.games](https://play.8bitarcade.games)
- **Documentation**: [docs.8bitarcade.games](https://docs.8bitarcade.games)
- **Discord**: https://discord.gg/AKrdPvHz4P
- **Telegram**: https://t.me/eight_bit_arcade
- **X/Twitter**: https://x.com/8_Bit_Arcade_

---

Built with ❤️ and 8-bit nostalgia

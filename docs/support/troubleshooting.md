# Troubleshooting

## Common Issues and Solutions

### Wallet Connection Issues

**Problem: "Connect Wallet" button not working**

Solutions:
1. Refresh the page
2. Check MetaMask is installed and unlocked
3. Try different browser (Chrome/Brave recommended)
4. Disable other wallet extensions temporarily
5. Clear browser cache and cookies

---

**Problem: "Wrong Network" error**

Solutions:
1. Open MetaMask
2. Click network dropdown (top center)
3. Select "Arbitrum One"
4. If not listed, add manually: [Instructions](../getting-started/connect-wallet.md#step-4-add-arbitrum-one-network)
5. Refresh page after switching

---

**Problem: Wallet connects but immediately disconnects**

Solutions:
1. Update MetaMask to latest version
2. Clear MetaMask cache (Settings → Advanced → Reset)
3. Try WalletConnect instead
4. Check firewall/antivirus isn't blocking
5. Try on different device to isolate issue

---

### Transaction Failures

**Problem: "Insufficient funds for gas"**

Solutions:
1. Get more ETH on Arbitrum (~$1-5 worth needed)
2. Bridge from Ethereum mainnet
3. Buy on exchange and withdraw to Arbitrum
4. Use faucet for testnet (if testing)

---

**Problem: Transaction pending forever**

Solutions:
1. Wait 5-10 minutes (occasionally delays)
2. Check Arbiscan for transaction status
3. If truly stuck, try "Speed Up" in MetaMask
4. Last resort: Cancel and retry

---

**Problem: "Transaction failed" but gas was paid**

Common causes:
- Slippage too low (increase to 1-2%)
- Price moved during transaction
- Contract out of tokens (rare)
- Wrong parameters sent

Solutions:
1. Try again with higher slippage
2. Refresh page and retry
3. Check contract still active
4. Contact support if persists

---

### Reward Issues

**Problem: Didn't receive daily rewards**

Checklist:
1. Did you rank top 10? Check final leaderboard
2. Wait 10 minutes after reset (sometimes delayed)
3. Check Arbiscan for transaction to your address
4. Add 8BIT token to MetaMask manually
5. Verify on correct network (Arbitrum)

If still missing after 1 hour: Contact support with wallet address and game name.

---

**Problem: Wrong reward amount**

Solutions:
1. Verify your actual rank (not during-day rank, but final)
2. Check reward structure for your rank
3. If genuinely wrong, contact support immediately
4. Provide: Date, game, rank, expected vs actual amount

---

### Gameplay Issues

**Problem: Game won't load**

Solutions:
1. Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
2. Clear browser cache
3. Disable browser extensions (especially ad blockers)
4. Try incognito/private mode
5. Try different browser
6. Check internet connection stable

---

**Problem: Controls not responding**

Solutions:
1. Click back into game window (browser may have lost focus)
2. Refresh page
3. Check keyboard is working (test in notepad)
4. Try different browser
5. Disable sticky keys (Windows accessibility feature)
6. Check browser zoom is 100%

---

**Problem: Game is laggy/choppy**

Solutions:
1. Close other browser tabs
2. Close background applications
3. Use wired internet (not WiFi)
4. Update browser to latest version
5. Check graphics drivers updated
6. Try lower quality settings (if available)

---

**Problem: Score submission failed**

Common causes:
- Not connected to wallet
- Insufficient ETH for gas
- Score flagged as invalid (anti-cheat)
- Network issues

Solutions:
1. Ensure wallet connected
2. Check ETH balance ($0.50 minimum)
3. Try submitting again
4. If flagged: Review anti-cheat policy (no cheating)
5. Contact support if legitimate score rejected

---

### Token & Trading Issues

**Problem: Can't see 8BIT balance in wallet**

Solutions:
1. Add token manually in MetaMask
2. Use contract address: [TBA]
3. Symbol: 8BIT, Decimals: 18
4. Ensure on Arbitrum network
5. Check Arbiscan to confirm tokens received

---

**Problem: Can't sell 8BIT on Uniswap**

Checklist:
1. On correct network (Arbitrum One)?
2. Have ETH for gas (~$0.50)?
3. Slippage set to 0.5-1%?
4. Token address correct?
5. Sufficient 8BIT balance?

If all yes and still failing: Try again later or contact support.

---

**Problem: High slippage warning**

Causes:
- Low liquidity
- Large trade size
- High volatility

Solutions:
1. Reduce trade size (split into multiple)
2. Wait for higher liquidity
3. Increase slippage tolerance (carefully)
4. Trade during peak hours

---

### Browser-Specific Issues

**Chrome/Brave:**
- Usually best compatibility
- If issues: Clear site data, try incognito mode

**Firefox:**
- May have stricter security
- Allow third-party cookies for wallet
- Check Enhanced Tracking Protection settings

**Safari:**
- Less tested, some features may not work
- Use Chrome/Brave for best experience
- If must use Safari, disable tracking prevention

**Mobile Browsers:**
- Use MetaMask in-app browser, or
- Use WalletConnect from any mobile browser
- Portrait mode recommended for most games

---

### Account & Leaderboard Issues

**Problem: Username not displaying**

Solutions:
1. Wait 5-10 minutes (blockchain confirmation)
2. Refresh page
3. Check transaction confirmed on Arbiscan
4. Clear browser cache
5. If still missing: Contact support

---

**Problem: Score showing but rank wrong**

Explanations:
- Leaderboard updates in real-time, others improved
- Check final rank at 00:00 UTC, not during day
- Rank shown during play may not be final
- Only top 10 at reset time earn rewards

---

**Problem: Can't enter tournament**

Checklist:
1. Tournament still open for registration?
2. Have enough USDC for entry fee?
3. Approved USDC spending in MetaMask?
4. Have ETH for gas?
5. Already entered this tournament? (can't double-enter)

---

### Error Messages

**"Execution Reverted"**
- Smart contract rejected transaction
- Usually means: invalid parameters, insufficient balance, or unauthorized action
- Check transaction details, retry

**"Nonce Too Low"**
- Transaction out of order
- MetaMask issue
- Solution: Settings → Advanced → Reset Account (clears pending tx)

**"Gas Estimation Failed"**
- Contract can't calculate gas needed
- Usually means transaction would fail
- Check all parameters correct, or contact support

**"Internal JSON-RPC Error"**
- MetaMask communication issue
- Solution: Refresh page, reconnect wallet

---

### Advanced Troubleshooting

**Completely Clear Cache (Nuclear Option)**

Chrome:
1. Settings → Privacy and Security
2. Clear Browsing Data
3. Select "All Time"
4. Check: Cookies, Cache, Site Data
5. Clear data
6. Restart browser

MetaMask:
1. Settings → Advanced
2. Reset Account (clears transaction history)
3. Or: Remove extension and reinstall (ONLY if you have seed phrase!)

**Check Contract Status**

Visit Arbiscan and search contract address:
- If contract paused/disabled, wait for team announcement
- Check official Discord/Twitter for status updates
- Platform may be under maintenance

**Network Issues**

Check Arbitrum network status:
- [status.arbitrum.io](https://status.arbitrum.io)
- [arbiscan.io](https://arbiscan.io) - if explorer down, network issue

---

## When to Contact Support

Contact support if:
- Issue persists after trying solutions above
- You lost funds due to platform error
- Transaction confirmed but rewards not received (after 1 hour)
- Account banned and you believe it's wrong
- Found a serious bug

**Before contacting, gather:**
- Wallet address
- Transaction hash (if applicable)
- Browser and version
- Exact error message (screenshot)
- Steps to reproduce

**Contact Methods:**
- Email: admin@8bitarcade.games
- Discord: #support channel
- [Contact form](contact.md)

**Expected Response Time:**
- Simple questions: 24 hours
- Technical issues: 48 hours
- Critical bugs: 6 hours
- Lost funds: 12 hours (priority)

---

## Preventing Issues

**Best Practices:**

1. **Always use supported browsers** (Chrome, Brave, Firefox)
2. **Keep MetaMask updated**
3. **Maintain $1-2 ETH balance** on Arbitrum for gas
4. **Bookmark official site** (avoid phishing)
5. **Enable transaction confirmations** in MetaMask
6. **Clear cache monthly**
7. **Verify contract addresses** before interacting

---

## Known Issues

> This section will list known bugs and their status

**Currently:** None (pre-launch)

**When reported, will include:**
- Issue description
- Temporary workaround (if any)
- ETA for fix
- Status: Investigating / Fix in progress / Resolved

---

## Self-Help Resources

- [FAQ](faq.md) - Quick answers
- [User Guides](../getting-started/how-to-play.md) - Step-by-step instructions
- [Discord](https://discord.gg/AKrdPvHz4P) - Community assistance

---

*Can't find your issue? Check [FAQ](faq.md) or [Contact Support](contact.md)*

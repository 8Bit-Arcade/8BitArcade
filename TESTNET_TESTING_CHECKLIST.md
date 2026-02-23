# 8-Bit Arcade Testnet Testing Checklist

## 🎯 Critical Integration Tests

Run through this checklist to verify your testnet deployment is working correctly.

---

## 1. Wallet Connection Tests

### Test 1.1: Connect Wallet
- [ ] Visit your live site
- [ ] Click "Connect Wallet" button
- [ ] Connect MetaMask
- [ ] **Expected:** Wallet connects successfully
- [ ] **Expected:** Shows correct wallet address in header

### Test 1.2: Network Detection
- [ ] Make sure MetaMask is on **Arbitrum Sepolia** (Chain ID: 421614)
- [ ] **Expected:** Site shows "Connected to Arbitrum Sepolia"
- [ ] **Expected:** No network mismatch warnings

### Test 1.3: Wrong Network Warning
- [ ] Switch MetaMask to Ethereum Mainnet
- [ ] **Expected:** Site shows "Wrong Network" warning
- [ ] **Expected:** Prompts to switch to Arbitrum Sepolia
- [ ] Click "Switch Network" button
- [ ] **Expected:** MetaMask prompts to switch
- [ ] **Expected:** Successfully switches to Arbitrum Sepolia

---

## 2. Faucet Tests

### Test 2.1: View Faucet Page
- [ ] Navigate to `/faucet` page
- [ ] **Expected:** Page loads without errors
- [ ] **Expected:** Shows "TESTNET FAUCET" header
- [ ] **Expected:** Shows faucet statistics (balance, distributed, claims)

### Test 2.2: Check Claim Eligibility
- [ ] Connect wallet
- [ ] **Expected:** Shows "Your Balance: X 8BIT"
- [ ] **Expected:** Shows "Total Claimed: X 8BIT"
- [ ] If balance > 5,000 8BIT:
  - [ ] **Expected:** Button shows "Balance Above Minimum" (disabled)
- [ ] If balance < 5,000 8BIT:
  - [ ] **Expected:** Button shows "Claim 10,000 8BIT" (enabled)

### Test 2.3: Claim Tokens
- [ ] Ensure balance is below 5,000 8BIT
- [ ] Click "Claim 10,000 8BIT" button
- [ ] **Expected:** MetaMask popup appears
- [ ] **Expected:** Shows gas estimate
- [ ] Confirm transaction in MetaMask
- [ ] **Expected:** Button changes to "Claiming..."
- [ ] Wait for transaction confirmation
- [ ] **Expected:** Success message: "✅ Tokens Claimed Successfully!"
- [ ] **Expected:** Balance increases by 10,000 8BIT
- [ ] **Expected:** "Total Claimed" updates

### Test 2.4: Cooldown Period
- [ ] After successful claim, refresh page
- [ ] **Expected:** Button shows "Cooldown: XXh XXm"
- [ ] **Expected:** Cannot claim again for 24 hours
- [ ] **Expected:** Countdown timer updates every second

### Test 2.5: Faucet Statistics Update
- [ ] After claiming, check statistics section
- [ ] **Expected:** "Total Distributed" increases
- [ ] **Expected:** "Total Claims" increases by 1
- [ ] **Expected:** "Unique Users" increases (if first claim)

---

## 3. Token Balance Tests

### Test 3.1: View Token in Wallet
- [ ] Open MetaMask
- [ ] Click "Assets" tab
- [ ] If 8BIT not visible:
  - [ ] Click "Import tokens"
  - [ ] Enter token address: `0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d`
  - [ ] **Expected:** Shows "8-Bit Arcade Token (8BIT)"
  - [ ] **Expected:** Shows correct balance

### Test 3.2: Token Transfer
- [ ] In MetaMask, click "Send"
- [ ] Send 100 8BIT to another address
- [ ] **Expected:** Transaction succeeds
- [ ] **Expected:** Balance decreases by 100 8BIT (+ gas)

---

## 4. Game Integration Tests

### Test 4.1: Play a Game
- [ ] Navigate to any game (e.g., `/games/pixel-snake`)
- [ ] **Expected:** Game loads without errors
- [ ] Play the game and achieve a score
- [ ] Submit score
- [ ] **Expected:** Score submission succeeds
- [ ] **Expected:** Score appears in leaderboard

### Test 4.2: Check Leaderboard
- [ ] Navigate to `/leaderboard`
- [ ] **Expected:** Shows daily leaderboard
- [ ] **Expected:** Shows your submitted score
- [ ] **Expected:** Shows other players' scores
- [ ] Switch to "All-Time" tab
- [ ] **Expected:** Shows all-time rankings

---

## 5. Tournament Tests

### Test 5.1: View Tournaments
- [ ] Navigate to `/tournaments`
- [ ] **Expected:** Page loads without errors
- [ ] **Expected:** Shows active tournaments (if any)
- [ ] **Expected:** Shows tournament details (prize pool, entry fee, end time)

### Test 5.2: Enter Tournament
- [ ] Click on an active tournament
- [ ] Click "Enter Tournament" button
- [ ] **Expected:** MetaMask prompts for entry fee approval
- [ ] Approve and confirm transaction
- [ ] **Expected:** Successfully enters tournament
- [ ] **Expected:** Shows "Entered" status

---

## 6. Contract Interaction Tests

### Test 6.1: Check Contract on Arbiscan
Visit each contract on Arbiscan and verify:

**8BIT Token:** https://sepolia.arbiscan.io/address/0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d
- [ ] Contract is verified ✅
- [ ] Can read contract functions
- [ ] Shows total supply: 500M max
- [ ] Shows your balance

**GameRewards:** https://sepolia.arbiscan.io/address/0x528c9130A05bEf9a9632FbB3D8735287A2e44a4E
- [ ] Contract is deployed
- [ ] Can read rewardsDistributor
- [ ] **Expected:** Shows `0x3879aA591532B8a7BCe322Edff8fD09F7FB5dC9B`

**TournamentManager:** https://sepolia.arbiscan.io/address/0xe06C92f15F426b0f6Fccb66302790E533C5Dfbb7
- [ ] Contract is deployed
- [ ] Can view tournaments
- [ ] Can read tournamentManager address

**TestnetFaucet:** https://sepolia.arbiscan.io/address/0x25A4109083f882FCFbC9Ea7cE5Cd942dbae38952
- [ ] Contract is verified ✅
- [ ] Can read CLAIM_AMOUNT (should be 10,000)
- [ ] Can read COOLDOWN_PERIOD (should be 86400 seconds = 24 hours)
- [ ] Can read getFaucetStats()

---

## 7. Common Issues to Check

### Issue 7.1: "Connect Wallet" Does Nothing
**Possible Causes:**
- WalletConnect Project ID not set
- Check browser console for errors
- **Fix:** Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to `.env.local`

### Issue 7.2: "Wrong Network" Even on Arbitrum Sepolia
**Possible Causes:**
- Frontend config has wrong chain ID
- **Check:** `frontend/src/config/contracts.ts` → CHAIN_ID should be 421614
- **Fix:** Verify USE_TESTNET = true

### Issue 7.3: Faucet Claim Button Disabled
**Possible Causes:**
- Balance above 5,000 8BIT
- Still in cooldown period (24 hours)
- Not connected to wallet
- Wrong network
**Check:** Look at the button text for reason

### Issue 7.4: Transaction Fails
**Possible Causes:**
- Insufficient ETH for gas
- Contract function reverted
- **Fix:** Check error message in MetaMask
- **Fix:** Ensure you have Arbitrum Sepolia ETH for gas

### Issue 7.5: "Cannot read properties of undefined"
**Possible Causes:**
- Contract address not set correctly
- **Check:** Browser console for specific error
- **Fix:** Verify all addresses in `frontend/src/config/contracts.ts`

---

## 8. Backend/Firebase Tests

### Test 8.1: Daily Reward Distribution
- [ ] Wait for midnight UTC
- [ ] Check Firebase Functions logs
- [ ] **Expected:** Daily reward distribution runs
- [ ] **Expected:** Top players receive rewards
- [ ] Check Firestore `rewards` collection
- [ ] **Expected:** New reward entries created

### Test 8.2: Automated Tournament Creation
- [ ] Check Firebase Functions logs
- [ ] **Expected:** Weekly tournament created on schedule
- [ ] Navigate to `/tournaments`
- [ ] **Expected:** New tournament appears

### Test 8.3: Treasury Gas Refills
- [ ] Check backend wallet balance on Arbiscan
- [ ] If below 0.05 ETH:
  - [ ] **Expected:** Treasury automatically refills it to 0.1 ETH
- [ ] Check TreasuryGasManager transactions on Arbiscan

---

## 9. Performance Tests

### Test 9.1: Page Load Speed
- [ ] Test site on https://pagespeed.web.dev/
- [ ] **Expected:** Performance score > 70
- [ ] **Expected:** First Contentful Paint < 2s

### Test 9.2: Transaction Speed
- [ ] Claim from faucet
- [ ] Time from click to confirmation
- [ ] **Expected:** < 30 seconds on Arbitrum Sepolia

---

## 10. Security Tests

### Test 10.1: Contract Ownership
Visit Arbiscan "Read Contract" for each contract:

**EightBitToken:**
- [ ] Read `owner()`
- [ ] **Expected:** Shows `0x92f5523c2329eE281E7FEB8808FcE4b49ab1ebf8` (your deployer)

**GameRewards:**
- [ ] Read `owner()`
- [ ] **Expected:** Shows your deployer address
- [ ] Read `rewardsDistributor()`
- [ ] **Expected:** Shows `0x3879aA591532B8a7BCe322Edff8fD09F7FB5dC9B` (backend wallet)

### Test 10.2: Unauthorized Access
- [ ] Try calling admin functions from non-owner wallet
- [ ] **Expected:** Transaction reverts with "Ownable: caller is not the owner"

---

## 11. Mobile Tests

### Test 11.1: Mobile Wallet Connection
- [ ] Open site on mobile browser
- [ ] Click "Connect Wallet"
- [ ] **Expected:** Opens MetaMask app or WalletConnect
- [ ] **Expected:** Successfully connects

### Test 11.2: Mobile Game Play
- [ ] Play a game on mobile
- [ ] **Expected:** Touch controls work
- [ ] **Expected:** Game runs smoothly
- [ ] Submit score
- [ ] **Expected:** Score submission works

---

## 12. Cross-Browser Tests

Test on multiple browsers:
- [ ] **Chrome** - Full functionality
- [ ] **Firefox** - Full functionality
- [ ] **Safari** - Full functionality
- [ ] **Brave** - Full functionality

---

## 📊 Test Results Summary

After completing all tests, fill out:

### Passing Tests
- Total tests run: ___
- Tests passed: ___
- Pass rate: ___%

### Critical Issues Found
1.
2.
3.

### Non-Critical Issues Found
1.
2.
3.

### Action Items
- [ ] Issue 1: ___
- [ ] Issue 2: ___
- [ ] Issue 3: ___

---

## 🎉 Deployment Ready Checklist

Before considering testnet deployment complete:

- [ ] All faucet tests pass
- [ ] All contract interaction tests pass
- [ ] No console errors in browser
- [ ] Mobile experience tested
- [ ] All contracts verified on Arbiscan
- [ ] Backend wallet has sufficient ETH for gas
- [ ] Firebase Functions deployed and running
- [ ] Daily rewards distributing correctly
- [ ] Tournaments creating automatically

---

**Testing Date:** _______________
**Tested By:** _______________
**Site URL:** _______________
**Network:** Arbitrum Sepolia Testnet (Chain ID: 421614)

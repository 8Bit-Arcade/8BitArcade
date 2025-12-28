# 8-Bit Arcade Smart Contract Security Audit Report

**Date:** December 28, 2025
**Auditor:** Claude Code
**Contracts Reviewed:** 9 Solidity contracts + Frontend/Backend code
**Network:** Arbitrum Sepolia Testnet

---

## Executive Summary

This audit reviews all 9 smart contracts and the associated frontend/backend code for the 8-Bit Arcade platform. The audit identifies **3 CRITICAL**, **5 HIGH**, **8 MEDIUM**, and **6 LOW** severity issues, plus several informational findings.

### Risk Rating Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 3 | Requires Immediate Action |
| HIGH | 5 | Requires Action Before Mainnet |
| MEDIUM | 8 | Should Be Addressed |
| LOW | 6 | Recommended Fixes |
| INFO | 7 | Best Practices |

---

## CRITICAL ISSUES

### C-01: Private Key Exposed in Git Repository
**File:** `contracts/.env` (line 22)
**Severity:** CRITICAL

The deployer private key is committed to the repository in plaintext:
```
PRIVATE_KEY=1507ba89ab9859cd1fcfda43939b9f098ba3a327f71e44b8a2a0a69a5f9668dd
```

**Impact:** Anyone with access to this repository can:
- Steal all funds from the wallet
- Deploy malicious contracts
- Call owner-only functions on deployed contracts
- Drain treasury and token balances

**Recommendation:**
1. **IMMEDIATELY** transfer all funds from this wallet
2. **IMMEDIATELY** rotate all API keys (ARBISCAN_API_KEY exposed too)
3. Add `.env` to `.gitignore` (should only have `.env.example` in git)
4. Use a new wallet for mainnet deployment
5. Consider the testnet contracts compromised - redeploy after fixes

---

### C-02: Ownership Renunciation Strategy Missing
**Files:** All contracts
**Severity:** CRITICAL (for legitimacy)

None of the contracts have a mechanism or plan for ownership renunciation. For a token to be considered "legit" in the crypto community, ownership should typically be renounced or transferred to a timelock/multisig.

**Current State:**
- `EightBitToken`: Owner can authorize unlimited minters
- `GameRewards`: Owner can change distributor at any time
- `TournamentManager`: Owner can withdraw all funds via `emergencyWithdraw()`
- `TokenSale`: Owner can withdraw funds anytime, change prices arbitrarily
- `TreasuryGasManager`: Owner controls all parameters
- `Staking`: Owner can start staking (one-time, acceptable)

**Impact:** Users may distrust the project due to:
- Rug pull risk (owner can drain funds)
- Centralization concerns
- No protection against malicious owner actions

**Recommendation:**
Create a tiered approach:

1. **Phase 1 (Token Sale):** Keep ownership for operational needs
2. **Phase 2 (Post-Sale):** Transfer ownership to a multisig (e.g., Gnosis Safe)
3. **Phase 3 (Maturity):** Consider renouncing ownership on `EightBitToken` after all minters are set

For `EightBitToken` specifically:
```solidity
// Add function to permanently lock minting configuration
bool public minterConfigLocked;

function lockMinterConfig() external onlyOwner {
    minterConfigLocked = true;
}

function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
    require(!minterConfigLocked, "Minter config is locked");
    // ... rest of function
}
```

---

### C-03: TournamentManager Prize Pool Insolvency Risk
**File:** `TournamentManager.sol` (lines 262-268)
**Severity:** CRITICAL

The contract promises fixed prize pools but relies on having sufficient token balance:
```solidity
// Prize pools (fixed amounts)
uint256 public constant STANDARD_WEEKLY_PRIZE = 50_000 * 10**18;
// ...

function declareWinner(...) external nonReentrant {
    // No check if contract has enough tokens!
    require(
        eightBitToken.transfer(winner, t.prizePool),
        "Prize transfer failed"
    );
}
```

**Impact:**
- If contract runs out of tokens, winners cannot receive prizes
- Entry fees were already burned (50%) - no refund mechanism
- Creates legal liability and reputation damage

**Recommendation:**
1. Add balance verification in `createTournament()`:
```solidity
require(
    eightBitToken.balanceOf(address(this)) >= prizePool,
    "Insufficient prize pool funds"
);
```

2. Add a reserve check before allowing tournament creation
3. Consider escrowing prize pool per tournament

---

## HIGH SEVERITY ISSUES

### H-01: TournamentPayments WETH Wrapping May Fail
**File:** `TournamentPayments.sol` (lines 174-176)
**Severity:** HIGH

The ETH wrapping uses a low-level call that may fail silently on some WETH implementations:
```solidity
(bool success,) = address(wethToken).call{value: msg.value}("");
require(success, "WETH wrap failed");
```

**Impact:**
- Standard WETH deposit is `WETH.deposit{value: x}()`
- Some WETH contracts may not accept raw ETH via fallback
- User's ETH could be stuck if wrapping fails unexpectedly

**Recommendation:**
Use interface-based deposit:
```solidity
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
}
// Then: IWETH(address(wethToken)).deposit{value: msg.value}();
```

---

### H-02: Simplified Tick Math is Incorrect for Production
**Files:** `TournamentPayments.sol`, `TournamentBuyback.sol`
**Severity:** HIGH

Both contracts use a placeholder implementation for Uniswap V3 price calculations:
```solidity
function _getSqrtRatioAtTick(int24 tick) internal pure returns (uint256 sqrtPriceX96) {
    // Simplified - in production use full TickMath library
    sqrtPriceX96 = uint256(2**96); // ALWAYS RETURNS SAME VALUE!
}
```

**Impact:**
- `_getQuoteAtTick()` returns incorrect prices
- Slippage protection is effectively broken
- Buyback swaps may fail or suffer massive slippage
- Price oracle returns constant 2^96 regardless of actual tick

**Recommendation:**
Import OpenZeppelin's TickMath library or Uniswap's official library:
```solidity
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
// Use: TickMath.getSqrtRatioAtTick(tick)
```

---

### H-03: manualDistributeRewards Has No Authentication
**File:** `functions/src/rewards/distributeRewards.ts` (lines 319-348)
**Severity:** HIGH

The manual trigger endpoint has no authentication:
```typescript
export const manualDistributeRewards = functions
  .https.onRequest(async (req, res) => {
    // ⚠️ SECURITY: Add authentication here in production!
    // Only allow authorized requests
```

**Impact:**
- Anyone can call this endpoint repeatedly
- Could drain gas wallet with repeated calls
- Could cause DoS by triggering distribution during processing

**Recommendation:**
Add Firebase Auth or API key validation:
```typescript
const apiKey = req.headers['x-api-key'];
if (apiKey !== functions.config().admin?.api_key) {
    return res.status(401).json({ error: 'Unauthorized' });
}
```

---

### H-04: ERC20 Return Value Not Checked (transferFrom)
**Files:** Multiple contracts
**Severity:** HIGH

Several contracts don't use SafeERC20 and some tokens don't return bool:
```solidity
// TokenSale.sol, TournamentManager.sol, etc.
require(
    usdcToken.transferFrom(msg.sender, address(this), usdcAmount),
    "USDC transfer failed"
);
```

**Impact:**
- Tokens like USDT don't return a value on transfer
- The `require` will fail even on successful transfers for such tokens
- Could prevent users from participating in sales/tournaments

**Recommendation:**
Use OpenZeppelin's SafeERC20:
```solidity
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
using SafeERC20 for IERC20;
// Then: usdcToken.safeTransferFrom(msg.sender, address(this), amount);
```

---

### H-05: Staking Reward Rate Calculation Precision Loss
**File:** `Staking.sol` (lines 87-91)
**Severity:** HIGH

```solidity
function rewardPerToken() public view returns (uint256) {
    uint256 rewardRate = getRewardRate();
    uint256 rewardPerSec = rewardRate / 30 days; // Integer division!
    return rewardPerTokenStored + (rewardPerSec * timeElapsed * 1e18 / totalStaked);
}
```

**Impact:**
- `833_333 * 10**18 / (30 * 24 * 60 * 60)` loses precision
- Small stakers may receive 0 rewards for short periods
- Cumulative effect compounds over 5 years

**Recommendation:**
Multiply before dividing:
```solidity
uint256 rewardPerSec = (rewardRate * 1e18) / (30 days);
return rewardPerTokenStored + (rewardPerSec * timeElapsed / totalStaked);
```

---

## MEDIUM SEVERITY ISSUES

### M-01: No Maximum Cap on Authorized Minters
**File:** `EightBitToken.sol` (lines 47-51)
**Severity:** MEDIUM

The owner can authorize unlimited minter addresses. There's no cap or enumeration.

**Recommendation:** Add a cap or use EnumerableSet to track minters.

---

### M-02: GameRewards dayId Has No Validation
**File:** `GameRewards.sol` (line 107)
**Severity:** MEDIUM

```solidity
function distributeRewards(uint256 dayId, ...) external {
    require(!rewardsDistributed[dayId], "Already distributed for this day");
```

**Impact:** A distributor could use any dayId (past or future dates, or arbitrary numbers).

**Recommendation:** Add bounds checking:
```solidity
require(dayId <= block.timestamp / 1 days, "Cannot distribute for future");
```

---

### M-03: TournamentManager getActiveTournamentsCount() DoS Risk
**File:** `TournamentManager.sol` (lines 342-350)
**Severity:** MEDIUM

```solidity
function getActiveTournamentsCount() external view returns (uint256) {
    uint256 count = 0;
    for (uint256 i = 1; i < nextTournamentId; i++) {
        if (tournaments[i].isActive && block.timestamp < tournaments[i].endTime) {
            count++;
        }
    }
    return count;
}
```

**Impact:** O(n) complexity grows unbounded. Will eventually hit gas limits.

**Recommendation:** Maintain a counter variable instead of iterating.

---

### M-04: TokenSale Emergency Withdraw Only After Finalization
**File:** `TokenSale.sol` (lines 403-407)
**Severity:** MEDIUM

```solidity
function emergencyWithdrawTokens(address token, address recipient) external onlyOwner {
    require(saleFinalized, "Can only use after sale finalized");
```

**Impact:** If something goes wrong during the sale, tokens cannot be recovered.

**Recommendation:** Consider adding a pause + emergency timelock pattern.

---

### M-05: TreasuryGasManager Permissionless Refill Could Be Griefed
**File:** `TreasuryGasManager.sol` (line 136)
**Severity:** MEDIUM

Anyone can call `refillGasWallet()`. While this is intentional for uptime, it could be griefed.

**Impact:** Attacker could drain treasury by triggering refills when not needed (by manipulating conditions).

**Recommendation:** Add minimum time between refills or caller whitelist option.

---

### M-06: TestnetFaucet claimers Array Grows Unbounded
**File:** `TestnetFaucet.sol` (lines 98-101)
**Severity:** MEDIUM

The `claimers` array grows forever with no cleanup mechanism.

**Impact:** `getClaimers()` will eventually hit gas limits.

---

### M-07: Staking exit() Can Revert if No Rewards
**File:** `Staking.sol` (lines 191-194)
**Severity:** MEDIUM

```solidity
function exit() external {
    withdraw(stakes[msg.sender].amount);
    claimReward(); // This will revert if rewards == 0
}
```

**Impact:** Users with 0 rewards cannot use `exit()` convenience function.

**Recommendation:** Don't revert on 0 rewards in `claimReward()`:
```solidity
if (reward == 0) return;
```

---

### M-08: TokenSale buyers Array Unbounded Growth
**File:** `TokenSale.sol` (lines 57, 204-208)
**Severity:** MEDIUM

The `buyers` array grows unboundedly, making `getBuyers()` eventually unusable.

---

## LOW SEVERITY ISSUES

### L-01: Missing Zero Address Checks in Some Functions
**Files:** Multiple
- `GameRewards.distributeRewards()` accepts address(0) in players array (handled but wasteful)
- `Staking.earned()` can be called with address(0)

---

### L-02: Block.timestamp Manipulation
All time-based logic uses `block.timestamp` which can be manipulated by ~15 seconds by miners.

**Impact:** Minimal for this use case but worth noting.

---

### L-03: No Event Emission for All State Changes
Some state changes don't emit events:
- `TokenSale.updateLimits()`
- `TokenSale.extendSale()`

---

### L-04: Magic Numbers in Code
Several hardcoded values without named constants:
- `500` fee tier in TournamentPayments
- `3000` fee tier for buybacks
- `300` (5 minutes) deadline
- `120n / 100n` for gas buffer

---

### L-05: Inconsistent Use of Pausable Pattern
Only `TokenSale` and `TestnetFaucet` have pause functionality. Consider adding to other critical contracts.

---

### L-06: TournamentBuyback collectFees Has No Access Control
**File:** `TournamentBuyback.sol` (line 105)

```solidity
function collectFees(uint256 amount) external nonReentrant {
    // Anyone can call if they have approved tokens
```

**Impact:** Minor - caller pays for tokens they send. But unexpected behavior.

---

## INFORMATIONAL FINDINGS

### I-01: Consider Using OpenZeppelin Upgradeable Contracts
For future-proofing, consider using upgradeable proxy patterns for contracts that may need updates.

### I-02: Frontend API Key Exposure
Firebase and WalletConnect API keys in frontend `.env` are public by nature but should still be secured with domain restrictions.

### I-03: Missing NatSpec Documentation
Many functions lack complete NatSpec documentation (@param, @return, @dev).

### I-04: Consider Adding Circuit Breakers
Add global pause functionality to all contracts for emergency situations.

### I-05: Hardcoded Contract Address in autoPriceUpdater
**File:** `functions/src/sale/autoPriceUpdater.ts` (line 38)
```typescript
const SALE_CONTRACT_ADDRESS = '0x057B1130dD6E8FcBc144bb34172e45293C6839fE';
```
Should use environment variable for mainnet flexibility.

### I-06: Admin Address Hardcoded
**File:** `functions/src/admin/adminFunctions.ts`
Admin addresses should be in secure configuration, not code.

### I-07: Recommend Adding Rate Limiting to Firebase Functions
The HTTP-triggered functions should have rate limiting to prevent abuse.

---

## OWNERSHIP RENUNCIATION RECOMMENDATIONS

For this project, I recommend a **staged approach** rather than immediate renunciation:

### Recommended Timeline:

| Phase | Timeframe | Action |
|-------|-----------|--------|
| 1 | Token Sale | Keep ownership (need to update prices, manage sale) |
| 2 | Post-Sale | Transfer all owners to 3-of-5 Multisig |
| 3 | 6 months | Lock minter configuration on EightBitToken |
| 4 | 1 year | Consider full renunciation on immutable contracts |

### Contracts Safe to Renounce Eventually:
- `EightBitToken` (after locking minter config)
- `TestnetFaucet` (testnet only, doesn't matter)

### Contracts That Need Owner:
- `TokenSale` - Price updates, finalization
- `GameRewards` - Distributor updates, pool adjustments
- `TournamentManager` - Tournament creation, emergencies
- `Staking` - Already minimal owner control
- `TreasuryGasManager` - Parameter adjustments

### Implementation:
1. Deploy a Gnosis Safe multisig on Arbitrum
2. Add trusted team members as signers (3-of-5 recommended)
3. Transfer ownership of all contracts to multisig
4. Announce multisig address publicly for transparency

---

## GAS OPTIMIZATION NOTES

1. **TournamentManager.getActiveTournamentsCount()**: Use counter instead of loop
2. **Cache storage reads**: Multiple reads of same storage variable (use local variable)
3. **Use `unchecked` blocks**: For increments that can't overflow (loop counters)
4. **Pack structs**: Reorder struct fields to minimize storage slots

---

## TESTING RECOMMENDATIONS

1. Add comprehensive unit tests for all edge cases
2. Add integration tests for contract interactions
3. Consider fuzzing with Foundry for numeric edge cases
4. Test with mainnet fork before deployment
5. Add CI/CD security scanning (Slither, Mythril)

---

## CONCLUSION

The 8-Bit Arcade smart contracts show a solid understanding of Solidity development patterns with appropriate use of OpenZeppelin libraries, ReentrancyGuard, and access controls. However, several critical and high-severity issues must be addressed before mainnet deployment:

**MUST FIX IMMEDIATELY:**
1. Rotate the exposed private key and redeploy contracts
2. Fix the placeholder TickMath implementations
3. Add SafeERC20 usage throughout
4. Add authentication to manual trigger endpoints

**MUST FIX BEFORE MAINNET:**
1. Implement ownership transfer to multisig
2. Add prize pool solvency checks
3. Fix WETH wrapping implementation
4. Add proper bounds checking on all inputs

**RECOMMENDED:**
1. Add comprehensive test suite
2. Get professional audit before mainnet
3. Implement staged ownership renunciation plan
4. Add monitoring and alerting for contract events

---

*This audit is provided for informational purposes. A professional third-party security audit is strongly recommended before mainnet deployment with real funds.*

# VestedAirdrop Contract

## Overview

The VestedAirdrop contract distributes 10 million 8BIT tokens to testnet participants with a 3-month vesting schedule.

## Contract Details

| Property | Value |
|----------|-------|
| **Contract** | VestedAirdrop.sol |
| **Network** | Arbitrum Sepolia (testnet) |
| **Address** | TBD (pending deployment) |
| **Total Allocation** | 10,000,000 8BIT |
| **Claim Window** | 90 days |
| **Vesting Period** | 60 days |

## Features

### Merkle Tree Verification

Uses OpenZeppelin's MerkleProof library for gas-efficient eligibility verification. Each user's allocation is verified against a pre-computed Merkle root.

### 3-Month Vesting Schedule

| Release | Timing | Percentage |
|---------|--------|------------|
| Initial | On claim | 33.33% |
| Month 1 | +30 days | 33.33% |
| Month 2 | +60 days | 33.34% |

### Claim Deadline

Users have 90 days from contract deployment to initiate their claim. After the deadline:
- New claims are disabled
- Unclaimed tokens can be recovered by treasury

## Key Functions

### For Users

```solidity
// Initiate claim with Merkle proof
function initiateClaim(uint256 amount, bytes32[] calldata proof) external

// Claim available vested tokens
function claimVested() external

// Check claimable amount
function getClaimable(address user) external view returns (uint256)

// Get full vesting info
function getVestingInfo(address user) external view returns (
    uint256 totalAmount,
    uint256 claimed,
    uint256 claimable,
    uint256 vestingStart,
    uint256 nextUnlock,
    uint256 percentVested
)
```

### For Verification

```solidity
// Check if user can claim
function canClaim(address user, uint256 amount, bytes32[] calldata proof) external view returns (bool)

// Debug: Get leaf hash for verification
function getLeafHash(address user, uint256 amount) external pure returns (bytes32)
```

### Admin Functions

```solidity
// Recover unclaimed tokens after deadline
function recoverUnclaimed(address treasury) external onlyOwner

// Debug: Manually set vesting start (testnet only)
function debugSetVestingStart(address user, uint256 timestamp) external onlyOwner
```

## Events

```solidity
event ClaimInitiated(address indexed user, uint256 totalAmount, uint256 initialRelease);
event VestedClaimed(address indexed user, uint256 amount);
event TokensRecovered(address indexed treasury, uint256 amount);
```

## Security Features

- **Merkle Proof**: Gas-efficient verification of eligibility
- **Reentrancy Guard**: Prevents reentrancy attacks during claims
- **Claim Deadline**: Time-limited claiming window
- **Treasury Recovery**: Unclaimed tokens returned to project

## Integration

### Frontend Integration

```typescript
import { useAirdrop } from '@/hooks/useAirdrop';

const {
  eligibility,
  initiateClaim,
  claimVested,
  vestingInfo
} = useAirdrop();
```

### Firebase Functions

```typescript
// Get user's allocation and proof
const status = await getAirdropStatus({ wallet: address });

// Mark claim as completed
await markAirdropClaimed({ snapshotId, txHash });
```

## Deployment

1. Generate Merkle tree from player activity data
2. Deploy VestedAirdrop with Merkle root and token address
3. Fund contract with 10M 8BIT tokens
4. Announce claim period to community

## Source Code

The contract source is available in the repository at:
`contracts/contracts/VestedAirdrop.sol`

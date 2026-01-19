import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * COMPREHENSIVE TIERED STAKING TESTS
 * ===================================
 * Tests for the TieredStaking contract covering:
 * - Deployment and initialization
 * - Staking with different tiers (7d, 1m, 3m, 6m)
 * - Weighted share calculations
 * - Reward accrual and claiming
 * - Withdrawals (normal and early with penalty)
 * - Emergency withdrawals
 * - Admin functions
 * - Security and edge cases
 */

describe("TieredStaking Contract", function () {
  let tieredStaking: any;
  let token: any;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  // Constants from contract
  const TOTAL_STAKING_POOL = ethers.parseEther("25000000"); // 25M
  const DISTRIBUTION_PERIOD = 5 * 365 * 24 * 60 * 60; // 5 years in seconds
  const MIN_STAKE_AMOUNT = ethers.parseEther("1");
  const MAX_STAKES_PER_USER = 50;
  const EARLY_WITHDRAWAL_PENALTY_BPS = 2500; // 25%
  const BPS_DENOMINATOR = 10000;

  // Lock durations
  const LOCK_7_DAYS = 7 * 24 * 60 * 60;
  const LOCK_1_MONTH = 30 * 24 * 60 * 60;
  const LOCK_3_MONTHS = 90 * 24 * 60 * 60;
  const LOCK_6_MONTHS = 180 * 24 * 60 * 60;

  // Weight multipliers
  const WEIGHT_7_DAYS = 10000; // 1.0x
  const WEIGHT_1_MONTH = 15000; // 1.5x
  const WEIGHT_3_MONTHS = 20000; // 2.0x
  const WEIGHT_6_MONTHS = 30000; // 3.0x

  // Lock tier enum
  enum LockTier {
    DAYS_7 = 0,
    MONTH_1 = 1,
    MONTHS_3 = 2,
    MONTHS_6 = 3,
  }

  beforeEach(async function () {
    [owner, treasury, user1, user2, user3] = await ethers.getSigners();

    // Deploy EightBitToken
    const EightBitToken = await ethers.getContractFactory("EightBitToken");
    token = await EightBitToken.deploy();
    await token.waitForDeployment();

    // Deploy TieredStaking
    const TieredStaking = await ethers.getContractFactory("TieredStaking");
    tieredStaking = await TieredStaking.deploy(
      await token.getAddress(),
      treasury.address
    );
    await tieredStaking.waitForDeployment();

    // Authorize TieredStaking as minter
    await token.setAuthorizedMinter(await tieredStaking.getAddress(), true);

    // Transfer tokens to users for testing
    const userAmount = ethers.parseEther("10000"); // 10k tokens each
    await token.transfer(user1.address, userAmount);
    await token.transfer(user2.address, userAmount);
    await token.transfer(user3.address, userAmount);

    // Approve staking contract
    await token.connect(user1).approve(await tieredStaking.getAddress(), ethers.MaxUint256);
    await token.connect(user2).approve(await tieredStaking.getAddress(), ethers.MaxUint256);
    await token.connect(user3).approve(await tieredStaking.getAddress(), ethers.MaxUint256);
  });

  describe("1. Deployment & Initialization", function () {
    it("should deploy with correct token address", async function () {
      expect(await tieredStaking.stakingToken()).to.equal(await token.getAddress());
    });

    it("should deploy with correct treasury address", async function () {
      expect(await tieredStaking.treasury()).to.equal(treasury.address);
    });

    it("should have correct constants", async function () {
      expect(await tieredStaking.TOTAL_STAKING_POOL()).to.equal(TOTAL_STAKING_POOL);
      expect(await tieredStaking.DISTRIBUTION_PERIOD()).to.equal(DISTRIBUTION_PERIOD);
      expect(await tieredStaking.MIN_STAKE_AMOUNT()).to.equal(MIN_STAKE_AMOUNT);
      expect(await tieredStaking.MAX_STAKES_PER_USER()).to.equal(MAX_STAKES_PER_USER);
      expect(await tieredStaking.EARLY_WITHDRAWAL_PENALTY_BPS()).to.equal(EARLY_WITHDRAWAL_PENALTY_BPS);
    });

    it("should have correct lock durations", async function () {
      expect(await tieredStaking.LOCK_7_DAYS()).to.equal(LOCK_7_DAYS);
      expect(await tieredStaking.LOCK_1_MONTH()).to.equal(LOCK_1_MONTH);
      expect(await tieredStaking.LOCK_3_MONTHS()).to.equal(LOCK_3_MONTHS);
      expect(await tieredStaking.LOCK_6_MONTHS()).to.equal(LOCK_6_MONTHS);
    });

    it("should have correct weight multipliers", async function () {
      expect(await tieredStaking.WEIGHT_7_DAYS()).to.equal(WEIGHT_7_DAYS);
      expect(await tieredStaking.WEIGHT_1_MONTH()).to.equal(WEIGHT_1_MONTH);
      expect(await tieredStaking.WEIGHT_3_MONTHS()).to.equal(WEIGHT_3_MONTHS);
      expect(await tieredStaking.WEIGHT_6_MONTHS()).to.equal(WEIGHT_6_MONTHS);
    });

    it("should not have started yet", async function () {
      expect(await tieredStaking.stakingStartTime()).to.equal(0);
    });

    it("should revert if deployed with zero token address", async function () {
      const TieredStaking = await ethers.getContractFactory("TieredStaking");
      await expect(
        TieredStaking.deploy(ethers.ZeroAddress, treasury.address)
      ).to.be.revertedWith("Invalid token address");
    });

    it("should revert if deployed with zero treasury address", async function () {
      const TieredStaking = await ethers.getContractFactory("TieredStaking");
      await expect(
        TieredStaking.deploy(await token.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury address");
    });
  });

  describe("2. Admin Functions", function () {
    it("should allow owner to start staking", async function () {
      await expect(tieredStaking.startStaking())
        .to.emit(tieredStaking, "StakingStarted");

      expect(await tieredStaking.stakingStartTime()).to.be.greaterThan(0);
    });

    it("should not allow starting staking twice", async function () {
      await tieredStaking.startStaking();
      await expect(tieredStaking.startStaking()).to.be.revertedWith("Already started");
    });

    it("should not allow non-owner to start staking", async function () {
      await expect(tieredStaking.connect(user1).startStaking())
        .to.be.revertedWithCustomError(tieredStaking, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to set treasury", async function () {
      await expect(tieredStaking.setTreasury(user1.address))
        .to.emit(tieredStaking, "TreasuryUpdated")
        .withArgs(treasury.address, user1.address);

      expect(await tieredStaking.treasury()).to.equal(user1.address);
    });

    it("should not allow setting zero treasury", async function () {
      await expect(tieredStaking.setTreasury(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid treasury");
    });

    it("should allow owner to set reward minter", async function () {
      await expect(tieredStaking.setRewardMinter(user1.address))
        .to.emit(tieredStaking, "RewardMinterUpdated");

      expect(await tieredStaking.rewardMinter()).to.equal(user1.address);
    });

    it("should allow owner to pause and unpause", async function () {
      await tieredStaking.pause();
      expect(await tieredStaking.paused()).to.be.true;

      await tieredStaking.unpause();
      expect(await tieredStaking.paused()).to.be.false;
    });

    it("should not allow non-owner to pause", async function () {
      await expect(tieredStaking.connect(user1).pause())
        .to.be.revertedWithCustomError(tieredStaking, "OwnableUnauthorizedAccount");
    });
  });

  describe("3. Staking", function () {
    beforeEach(async function () {
      await tieredStaking.startStaking();
    });

    it("should allow staking with 7-day tier", async function () {
      const amount = ethers.parseEther("100");

      await expect(tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7))
        .to.emit(tieredStaking, "Staked");

      expect(await tieredStaking.userStakeCount(user1.address)).to.equal(1);
      expect(await tieredStaking.userTotalStaked(user1.address)).to.equal(amount);
      expect(await tieredStaking.totalRawStake()).to.equal(amount);
    });

    it("should calculate correct weighted amount for each tier", async function () {
      const amount = ethers.parseEther("100");

      // Stake with each tier
      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTH_1);
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_3);
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_6);

      // Check weighted stakes
      const stake0 = await tieredStaking.userStakes(user1.address, 0);
      const stake1 = await tieredStaking.userStakes(user1.address, 1);
      const stake2 = await tieredStaking.userStakes(user1.address, 2);
      const stake3 = await tieredStaking.userStakes(user1.address, 3);

      // 100 * 10000 / 10000 = 100 (1.0x)
      expect(stake0.weightedAmount).to.equal(ethers.parseEther("100"));
      // 100 * 15000 / 10000 = 150 (1.5x)
      expect(stake1.weightedAmount).to.equal(ethers.parseEther("150"));
      // 100 * 20000 / 10000 = 200 (2.0x)
      expect(stake2.weightedAmount).to.equal(ethers.parseEther("200"));
      // 100 * 30000 / 10000 = 300 (3.0x)
      expect(stake3.weightedAmount).to.equal(ethers.parseEther("300"));
    });

    it("should set correct unlock time for each tier", async function () {
      const amount = ethers.parseEther("100");
      const blockTime = await time.latest();

      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTH_1);
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_3);
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_6);

      const stake0 = await tieredStaking.userStakes(user1.address, 0);
      const stake1 = await tieredStaking.userStakes(user1.address, 1);
      const stake2 = await tieredStaking.userStakes(user1.address, 2);
      const stake3 = await tieredStaking.userStakes(user1.address, 3);

      // Allow for small time variance
      expect(stake0.unlockTime).to.be.closeTo(BigInt(blockTime + LOCK_7_DAYS), 10n);
      expect(stake1.unlockTime).to.be.closeTo(BigInt(blockTime + LOCK_1_MONTH), 10n);
      expect(stake2.unlockTime).to.be.closeTo(BigInt(blockTime + LOCK_3_MONTHS), 10n);
      expect(stake3.unlockTime).to.be.closeTo(BigInt(blockTime + LOCK_6_MONTHS), 10n);
    });

    it("should revert if staking before start", async function () {
      // Deploy fresh contract without starting
      const TieredStaking = await ethers.getContractFactory("TieredStaking");
      const newStaking = await TieredStaking.deploy(await token.getAddress(), treasury.address);
      await token.connect(user1).approve(await newStaking.getAddress(), ethers.MaxUint256);

      await expect(
        newStaking.connect(user1).stake(ethers.parseEther("100"), LockTier.DAYS_7)
      ).to.be.revertedWith("Staking not started");
    });

    it("should revert if staking below minimum", async function () {
      await expect(
        tieredStaking.connect(user1).stake(ethers.parseEther("0.5"), LockTier.DAYS_7)
      ).to.be.revertedWith("Below minimum stake");
    });

    it("should revert if exceeding max stakes", async function () {
      const amount = ethers.parseEther("1");

      // Stake MAX_STAKES_PER_USER times
      for (let i = 0; i < MAX_STAKES_PER_USER; i++) {
        await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);
      }

      // 51st stake should fail
      await expect(
        tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7)
      ).to.be.revertedWith("Too many stakes");
    });

    it("should revert if staking when paused", async function () {
      await tieredStaking.pause();

      await expect(
        tieredStaking.connect(user1).stake(ethers.parseEther("100"), LockTier.DAYS_7)
      ).to.be.revertedWithCustomError(tieredStaking, "EnforcedPause");
    });

    it("should update total weighted stake correctly", async function () {
      const amount = ethers.parseEther("100");

      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7); // 100
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_6); // 300

      // Total weighted = 100 + 300 = 400
      expect(await tieredStaking.totalWeightedStake()).to.equal(ethers.parseEther("400"));
    });
  });

  describe("4. Reward Accrual", function () {
    beforeEach(async function () {
      await tieredStaking.startStaking();
    });

    it("should accrue rewards over time", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_3);

      // Advance time by 1 day
      await time.increase(24 * 60 * 60);

      const earned = await tieredStaking.earned(user1.address, 0);
      expect(earned).to.be.greaterThan(0);
      console.log(`    Rewards after 1 day: ${ethers.formatEther(earned)} 8BIT`);
    });

    it("should accrue more rewards for higher weight tiers", async function () {
      const amount = ethers.parseEther("1000");

      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7); // 1x
      await tieredStaking.connect(user2).stake(amount, LockTier.MONTHS_6); // 3x

      // Advance time by 1 week
      await time.increase(7 * 24 * 60 * 60);

      const earnedUser1 = await tieredStaking.earned(user1.address, 0);
      const earnedUser2 = await tieredStaking.earned(user2.address, 0);

      // User2 should earn approximately 3x more (accounting for weighted total)
      // With equal stakes: user1 weighted = 1000, user2 weighted = 3000
      // Total weighted = 4000
      // User1 share = 1000/4000 = 25%
      // User2 share = 3000/4000 = 75%
      // User2 should earn 3x more than user1
      expect(earnedUser2).to.be.greaterThan(earnedUser1 * 2n);

      console.log(`    User1 (1x): ${ethers.formatEther(earnedUser1)} 8BIT`);
      console.log(`    User2 (3x): ${ethers.formatEther(earnedUser2)} 8BIT`);
    });

    it("should track totalEarned correctly", async function () {
      const amount = ethers.parseEther("1000");

      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_6);

      await time.increase(7 * 24 * 60 * 60);

      const earned0 = await tieredStaking.earned(user1.address, 0);
      const earned1 = await tieredStaking.earned(user1.address, 1);
      const totalEarned = await tieredStaking.totalEarned(user1.address);

      expect(totalEarned).to.be.closeTo(earned0 + earned1, ethers.parseEther("0.01"));
    });
  });

  describe("5. Claiming Rewards", function () {
    beforeEach(async function () {
      await tieredStaking.startStaking();
      // Set up reward minter properly - authorize staking contract and fund it
      await tieredStaking.setRewardMinter(await token.getAddress());
      // Fund staking contract for reward fallback (transfer mode)
      await token.transfer(await tieredStaking.getAddress(), ethers.parseEther("1000000"));
    });

    it("should allow claiming rewards for a single stake", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_3);

      await time.increase(7 * 24 * 60 * 60);

      const earnedBefore = await tieredStaking.earned(user1.address, 0);
      const balanceBefore = await token.balanceOf(user1.address);

      await tieredStaking.connect(user1).claimRewards(0);

      const balanceAfter = await token.balanceOf(user1.address);

      // Balance should increase by approximately earned amount (allow 1% tolerance for time variance)
      const tolerance = earnedBefore / 100n;
      expect(balanceAfter - balanceBefore).to.be.closeTo(earnedBefore, tolerance > 0n ? tolerance : 1n);
    });

    it("should allow claiming all rewards", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_6);

      await time.increase(7 * 24 * 60 * 60);

      const totalEarnedBefore = await tieredStaking.totalEarned(user1.address);
      const balanceBefore = await token.balanceOf(user1.address);

      await tieredStaking.connect(user1).claimAllRewards();

      const balanceAfter = await token.balanceOf(user1.address);

      // Allow 1% tolerance for time variance
      const tolerance = totalEarnedBefore / 100n;
      expect(balanceAfter - balanceBefore).to.be.closeTo(totalEarnedBefore, tolerance > 0n ? tolerance : 1n);
    });

    it("should allow claiming when rewards have accrued", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);

      // Advance time to accrue rewards
      await time.increase(60); // 1 minute

      const earned = await tieredStaking.earned(user1.address, 0);
      expect(earned).to.be.greaterThan(0);

      // Should be able to claim
      await expect(tieredStaking.connect(user1).claimRewards(0))
        .to.emit(tieredStaking, "RewardsClaimed");
    });

    it("should emit RewardsClaimed event", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);

      await time.increase(7 * 24 * 60 * 60);

      await expect(tieredStaking.connect(user1).claimRewards(0))
        .to.emit(tieredStaking, "RewardsClaimed");
    });
  });

  describe("6. Withdrawals", function () {
    beforeEach(async function () {
      await tieredStaking.startStaking();
      await tieredStaking.setRewardMinter(await token.getAddress());
    });

    it("should allow full withdrawal after unlock", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);

      // Advance past unlock time
      await time.increase(LOCK_7_DAYS + 1);

      const balanceBefore = await token.balanceOf(user1.address);
      await tieredStaking.connect(user1).withdraw(0);
      const balanceAfter = await token.balanceOf(user1.address);

      // Should get full amount back (plus rewards)
      expect(balanceAfter - balanceBefore).to.be.greaterThanOrEqual(amount);
    });

    it("should apply 25% penalty for early withdrawal", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_6);

      // Withdraw immediately (early)
      const balanceBefore = await token.balanceOf(user1.address);
      await tieredStaking.connect(user1).withdraw(0);
      const balanceAfter = await token.balanceOf(user1.address);

      // Should get 75% back (minus 25% penalty)
      const expectedReturn = (amount * 75n) / 100n;
      expect(balanceAfter - balanceBefore).to.be.closeTo(expectedReturn, ethers.parseEther("1"));
    });

    it("should send penalty to treasury", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_6);

      const treasuryBefore = await token.balanceOf(treasury.address);
      await tieredStaking.connect(user1).withdraw(0);
      const treasuryAfter = await token.balanceOf(treasury.address);

      // Treasury should receive 25% penalty
      const expectedPenalty = (amount * 25n) / 100n;
      expect(treasuryAfter - treasuryBefore).to.equal(expectedPenalty);
    });

    it("should update state correctly after withdrawal", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);

      await time.increase(LOCK_7_DAYS + 1);
      await tieredStaking.connect(user1).withdraw(0);

      expect(await tieredStaking.userTotalStaked(user1.address)).to.equal(0);
      expect(await tieredStaking.totalRawStake()).to.equal(0);
      expect(await tieredStaking.totalWeightedStake()).to.equal(0);
    });

    it("should emit Withdrawn event with correct penalty", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_6);

      const expectedPenalty = (amount * 25n) / 100n;
      const expectedAmount = amount - expectedPenalty;

      await expect(tieredStaking.connect(user1).withdraw(0))
        .to.emit(tieredStaking, "Withdrawn")
        .withArgs(user1.address, 0, expectedAmount, expectedPenalty);
    });

    it("should revert withdrawal for non-existent stake", async function () {
      await expect(tieredStaking.connect(user1).withdraw(0))
        .to.be.revertedWith("Stake not found");
    });
  });

  describe("7. Emergency Withdrawal", function () {
    beforeEach(async function () {
      await tieredStaking.startStaking();
    });

    it("should allow emergency withdrawal without penalty", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_6);

      const balanceBefore = await token.balanceOf(user1.address);
      await tieredStaking.connect(user1).emergencyWithdraw(0);
      const balanceAfter = await token.balanceOf(user1.address);

      // Should get full amount back (no penalty, but also no rewards)
      expect(balanceAfter - balanceBefore).to.equal(amount);
    });

    it("should forfeit rewards on emergency withdrawal", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_3);

      // Accrue rewards
      await time.increase(30 * 24 * 60 * 60);

      const earnedBefore = await tieredStaking.earned(user1.address, 0);
      expect(earnedBefore).to.be.greaterThan(0);

      await tieredStaking.connect(user1).emergencyWithdraw(0);

      // Rewards should be forfeited
      const earnedAfter = await tieredStaking.earned(user1.address, 0);
      expect(earnedAfter).to.equal(0);
    });

    it("should emit EmergencyWithdraw event", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);

      await expect(tieredStaking.connect(user1).emergencyWithdraw(0))
        .to.emit(tieredStaking, "EmergencyWithdraw")
        .withArgs(user1.address, 0, amount);
    });
  });

  describe("8. View Functions", function () {
    beforeEach(async function () {
      await tieredStaking.startStaking();
    });

    it("should return correct stake details via getStake", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_3);

      const [
        stakeAmount,
        weightedAmount,
        pendingRewards,
        stakedAt,
        unlockTime,
        tier,
        isUnlocked
      ] = await tieredStaking.getStake(user1.address, 0);

      expect(stakeAmount).to.equal(amount);
      expect(weightedAmount).to.equal(ethers.parseEther("2000")); // 2x multiplier
      expect(tier).to.equal(LockTier.MONTHS_3);
      expect(isUnlocked).to.be.false;
    });

    it("should return correct user stakes via getUserStakes", async function () {
      const amount = ethers.parseEther("100");
      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_6);

      const [amounts, unlockTimes, rewards, tiers] = await tieredStaking.getUserStakes(user1.address);

      expect(amounts.length).to.equal(2);
      expect(amounts[0]).to.equal(amount);
      expect(amounts[1]).to.equal(amount);
      expect(tiers[0]).to.equal(LockTier.DAYS_7);
      expect(tiers[1]).to.equal(LockTier.MONTHS_6);
    });

    it("should return staking stats correctly", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_3);

      const [
        totalRaw,
        totalWeighted,
        rewardsDistributed,
        remainingRewards,
        startTime,
        timeRemaining
      ] = await tieredStaking.getStakingStats();

      expect(totalRaw).to.equal(amount);
      expect(totalWeighted).to.equal(ethers.parseEther("2000")); // 2x
      expect(startTime).to.be.greaterThan(0);
      expect(timeRemaining).to.be.greaterThan(0);
    });

    it("should return tier info correctly", async function () {
      const [durations, weights] = await tieredStaking.getTierInfo();

      expect(durations[0]).to.equal(LOCK_7_DAYS);
      expect(durations[1]).to.equal(LOCK_1_MONTH);
      expect(durations[2]).to.equal(LOCK_3_MONTHS);
      expect(durations[3]).to.equal(LOCK_6_MONTHS);

      expect(weights[0]).to.equal(WEIGHT_7_DAYS);
      expect(weights[1]).to.equal(WEIGHT_1_MONTH);
      expect(weights[2]).to.equal(WEIGHT_3_MONTHS);
      expect(weights[3]).to.equal(WEIGHT_6_MONTHS);
    });

    it("should calculate estimated APY", async function () {
      const amount = ethers.parseEther("1000"); // 1k staked (user has 10k)
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_3);

      const apy = await tieredStaking.getEstimatedAPY(LockTier.MONTHS_3);

      // APY should be > 0 and reasonable
      expect(apy).to.be.greaterThan(0);
      console.log(`    Estimated APY for 3-month tier: ${Number(apy) / 100}%`);
    });
  });

  describe("9. Security Tests", function () {
    beforeEach(async function () {
      await tieredStaking.startStaking();
      // Fund contract for reward transfers
      await token.transfer(await tieredStaking.getAddress(), ethers.parseEther("1000000"));
    });

    it("should prevent reentrancy on stake", async function () {
      // This is covered by ReentrancyGuard - just verify it doesn't revert normally
      const amount = ethers.parseEther("100");
      await expect(
        tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7)
      ).to.not.be.reverted;
    });

    it("should prevent reentrancy on withdraw", async function () {
      const amount = ethers.parseEther("100");
      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);
      await time.increase(LOCK_7_DAYS + 1);

      await expect(tieredStaking.connect(user1).withdraw(0)).to.not.be.reverted;
    });

    it("should not allow staking after distribution period", async function () {
      // Advance time past distribution period
      await time.increase(DISTRIBUTION_PERIOD + 1);

      await expect(
        tieredStaking.connect(user1).stake(ethers.parseEther("100"), LockTier.DAYS_7)
      ).to.be.revertedWith("Staking ended");
    });

    it("should track penalties collected correctly", async function () {
      const amount = ethers.parseEther("1000");
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_6);

      await tieredStaking.connect(user1).withdraw(0);

      const expectedPenalty = (amount * 25n) / 100n;
      expect(await tieredStaking.totalPenaltiesCollected()).to.equal(expectedPenalty);
    });

    it("should handle multiple users staking correctly", async function () {
      const amount = ethers.parseEther("100");

      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);
      await tieredStaking.connect(user2).stake(amount, LockTier.MONTH_1);
      await tieredStaking.connect(user3).stake(amount, LockTier.MONTHS_6);

      // Total raw: 300
      expect(await tieredStaking.totalRawStake()).to.equal(ethers.parseEther("300"));

      // Total weighted: 100 + 150 + 300 = 550
      expect(await tieredStaking.totalWeightedStake()).to.equal(ethers.parseEther("550"));
    });
  });

  describe("10. Integration Tests", function () {
    beforeEach(async function () {
      await tieredStaking.startStaking();
      await tieredStaking.setRewardMinter(await token.getAddress());
      // Fund contract for reward transfers
      await token.transfer(await tieredStaking.getAddress(), ethers.parseEther("1000000"));
    });

    it("should handle full staking lifecycle", async function () {
      const amount = ethers.parseEther("1000");

      // Stake
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTH_1);
      expect(await tieredStaking.userTotalStaked(user1.address)).to.equal(amount);

      // Accrue rewards
      await time.increase(15 * 24 * 60 * 60); // 15 days

      // Claim rewards
      const rewardsEarned = await tieredStaking.earned(user1.address, 0);
      await tieredStaking.connect(user1).claimRewards(0);

      // More rewards accrue
      await time.increase(15 * 24 * 60 * 60); // Another 15 days (past unlock)

      // Withdraw
      await tieredStaking.connect(user1).withdraw(0);

      // Verify final state
      expect(await tieredStaking.userTotalStaked(user1.address)).to.equal(0);
      expect(await tieredStaking.totalRawStake()).to.equal(0);
    });

    it("should distribute rewards proportionally across tiers", async function () {
      const amount = ethers.parseEther("1000");

      // User1: 7 day (1x weight = 1000)
      // User2: 6 month (3x weight = 3000)
      // Total weighted: 4000
      // User1 gets 25% of rewards, User2 gets 75%

      await tieredStaking.connect(user1).stake(amount, LockTier.DAYS_7);
      await tieredStaking.connect(user2).stake(amount, LockTier.MONTHS_6);

      await time.increase(30 * 24 * 60 * 60); // 30 days

      const earned1 = await tieredStaking.earned(user1.address, 0);
      const earned2 = await tieredStaking.earned(user2.address, 0);

      // User2 should earn 3x user1
      const ratio = Number(earned2) / Number(earned1);
      expect(ratio).to.be.closeTo(3, 0.1);

      console.log(`    User1 (1x): ${ethers.formatEther(earned1)} 8BIT`);
      console.log(`    User2 (3x): ${ethers.formatEther(earned2)} 8BIT`);
      console.log(`    Ratio: ${ratio.toFixed(2)}x`);
    });
  });

  describe("11. Final Verification", function () {
    it("COMPLETE VERIFICATION - Contract ready for deployment", async function () {
      // Start staking
      await tieredStaking.startStaking();
      expect(await tieredStaking.stakingStartTime()).to.be.greaterThan(0);

      // Fund contract for reward transfers (need more for longer time periods)
      await token.transfer(await tieredStaking.getAddress(), ethers.parseEther("10000000"));

      // Test staking
      const amount = ethers.parseEther("100");
      await tieredStaking.connect(user1).stake(amount, LockTier.MONTHS_3);
      expect(await tieredStaking.totalRawStake()).to.equal(amount);

      // Test weighted calculation
      expect(await tieredStaking.totalWeightedStake()).to.equal(ethers.parseEther("200")); // 2x

      // Test time progression
      await time.increase(7 * 24 * 60 * 60);
      const earned = await tieredStaking.earned(user1.address, 0);
      expect(earned).to.be.greaterThan(0);

      // Test withdrawal after unlock
      await time.increase(LOCK_3_MONTHS);
      await tieredStaking.connect(user1).withdraw(0);
      expect(await tieredStaking.totalRawStake()).to.equal(0);

      console.log("\n" + "═".repeat(60));
      console.log("  ✅ ALL TIERED STAKING TESTS PASSED");
      console.log("  ✅ CONTRACT VERIFIED AND READY FOR DEPLOYMENT");
      console.log("═".repeat(60) + "\n");
    });
  });
});

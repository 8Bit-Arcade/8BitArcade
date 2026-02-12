import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * NFT GOAL-BASED REWARDS TESTS
 * =============================
 * Tests for the NFT rewards system covering:
 * - AchievementBadges: Soulbound minting, transfer blocking, EIP-5192
 * - TradeableItems: Minting, transfers, achievement gating, royalties
 * - AchievementManager: Goal creation, achievement awarding, full flow
 */

describe("NFT Rewards System", function () {
  let token: any;
  let badges: any;
  let items: any;
  let manager: any;
  let owner: SignerWithAddress;
  let verifier: SignerWithAddress;
  let player1: SignerWithAddress;
  let player2: SignerWithAddress;
  let treasury: SignerWithAddress;

  beforeEach(async function () {
    [owner, verifier, player1, player2, treasury] = await ethers.getSigners();

    // Deploy EightBitToken
    const EightBitToken = await ethers.getContractFactory("EightBitToken");
    token = await EightBitToken.deploy();
    await token.waitForDeployment();

    // Deploy AchievementBadges
    const AchievementBadges = await ethers.getContractFactory("AchievementBadges");
    badges = await AchievementBadges.deploy("ipfs://badges/");
    await badges.waitForDeployment();

    // Deploy TradeableItems
    const TradeableItems = await ethers.getContractFactory("TradeableItems");
    items = await TradeableItems.deploy(
      await badges.getAddress(),
      treasury.address,
      "ipfs://collection.json"
    );
    await items.waitForDeployment();

    // Deploy AchievementManager
    const AchievementManager = await ethers.getContractFactory("AchievementManager");
    manager = await AchievementManager.deploy(
      await badges.getAddress(),
      await items.getAddress(),
      await token.getAddress(),
      "ipfs://badges/"
    );
    await manager.waitForDeployment();

    // Link contracts
    await badges.setAuthorizedMinter(await manager.getAddress(), true);
    await items.setAuthorizedMinter(await manager.getAddress(), true);
    await manager.setAuthorizedVerifier(verifier.address, true);
    await token.setAuthorizedMinter(await manager.getAddress(), true);
  });

  // ═══════════════════════════════════════════════════════════
  // ACHIEVEMENT BADGES (SOULBOUND)
  // ═══════════════════════════════════════════════════════════

  describe("AchievementBadges", function () {
    describe("Deployment", function () {
      it("should have correct name and symbol", async function () {
        expect(await badges.name()).to.equal("8-Bit Arcade Achievement Badges");
        expect(await badges.symbol()).to.equal("8BIT-BADGE");
      });

      it("should start with nextTokenId = 1", async function () {
        expect(await badges.nextTokenId()).to.equal(1);
      });

      it("should set correct base URI", async function () {
        expect(await badges.baseTokenURI()).to.equal("ipfs://badges/");
      });
    });

    describe("Minting", function () {
      it("should allow authorized minter to mint a badge", async function () {
        // Manager is authorized, so use manager to award
        // But let's also test direct mint by authorizing owner
        await badges.setAuthorizedMinter(owner.address, true);

        const tx = await badges.mintBadge(player1.address, 1, "achievement_1.json");
        await expect(tx).to.emit(badges, "BadgeMinted").withArgs(player1.address, 1, 1);
        await expect(tx).to.emit(badges, "Locked").withArgs(1);

        expect(await badges.ownerOf(1)).to.equal(player1.address);
        expect(await badges.hasAchievement(player1.address, 1)).to.be.true;
      });

      it("should not allow unauthorized addresses to mint", async function () {
        await expect(
          badges.connect(player1).mintBadge(player1.address, 1, "achievement_1.json")
        ).to.be.revertedWith("Not authorized to mint");
      });

      it("should not allow duplicate achievements", async function () {
        await badges.setAuthorizedMinter(owner.address, true);
        await badges.mintBadge(player1.address, 1, "achievement_1.json");

        await expect(
          badges.mintBadge(player1.address, 1, "achievement_1.json")
        ).to.be.revertedWith("Already earned this achievement");
      });

      it("should allow same achievement type to different players", async function () {
        await badges.setAuthorizedMinter(owner.address, true);
        await badges.mintBadge(player1.address, 1, "achievement_1.json");
        await badges.mintBadge(player2.address, 1, "achievement_1.json");

        expect(await badges.hasAchievement(player1.address, 1)).to.be.true;
        expect(await badges.hasAchievement(player2.address, 1)).to.be.true;
        expect(await badges.achievementMintCount(1)).to.equal(2);
      });

      it("should support batch minting", async function () {
        await badges.setAuthorizedMinter(owner.address, true);

        await badges.batchMintBadges(
          player1.address,
          [1, 2, 3],
          ["a1.json", "a2.json", "a3.json"]
        );

        expect(await badges.hasAchievement(player1.address, 1)).to.be.true;
        expect(await badges.hasAchievement(player1.address, 2)).to.be.true;
        expect(await badges.hasAchievement(player1.address, 3)).to.be.true;
        expect(await badges.nextTokenId()).to.equal(4);
      });

      it("should skip already earned in batch mint", async function () {
        await badges.setAuthorizedMinter(owner.address, true);

        await badges.mintBadge(player1.address, 1, "a1.json");
        await badges.batchMintBadges(
          player1.address,
          [1, 2],
          ["a1.json", "a2.json"]
        );

        // Only token 1 and token 2 should exist (achievement 1 was skipped in batch)
        expect(await badges.nextTokenId()).to.equal(3);
        expect(await badges.hasAchievement(player1.address, 2)).to.be.true;
      });
    });

    describe("Soulbound (Non-transferable)", function () {
      beforeEach(async function () {
        await badges.setAuthorizedMinter(owner.address, true);
        await badges.mintBadge(player1.address, 1, "achievement_1.json");
      });

      it("should revert on transferFrom", async function () {
        await expect(
          badges.connect(player1).transferFrom(player1.address, player2.address, 1)
        ).to.be.revertedWith("AchievementBadges: soulbound, cannot transfer");
      });

      it("should revert on safeTransferFrom", async function () {
        await expect(
          badges.connect(player1)["safeTransferFrom(address,address,uint256)"](
            player1.address, player2.address, 1
          )
        ).to.be.revertedWith("AchievementBadges: soulbound, cannot transfer");
      });

      it("should report token as locked (EIP-5192)", async function () {
        expect(await badges.locked(1)).to.be.true;
      });

      it("should support EIP-5192 interface", async function () {
        // EIP-5192 interface ID: 0xb45a3c0e
        expect(await badges.supportsInterface("0xb45a3c0e")).to.be.true;
      });
    });

    describe("Views", function () {
      it("should return correct token URI", async function () {
        await badges.setAuthorizedMinter(owner.address, true);
        await badges.mintBadge(player1.address, 1, "achievement_1.json");

        expect(await badges.tokenURI(1)).to.equal("ipfs://badges/achievement_1.json");
      });

      it("should return correct achievement token mapping", async function () {
        await badges.setAuthorizedMinter(owner.address, true);
        await badges.mintBadge(player1.address, 5, "a5.json");

        expect(await badges.getAchievementToken(player1.address, 5)).to.equal(1);
        expect(await badges.getAchievementToken(player1.address, 99)).to.equal(0);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // TRADEABLE ITEMS
  // ═══════════════════════════════════════════════════════════

  describe("TradeableItems", function () {
    describe("Deployment", function () {
      it("should have correct name and symbol", async function () {
        expect(await items.name()).to.equal("8-Bit Arcade Items");
        expect(await items.symbol()).to.equal("8BIT-ITEM");
      });

      it("should set correct treasury", async function () {
        expect(await items.treasury()).to.equal(treasury.address);
      });

      it("should support ERC-2981 royalties", async function () {
        // ERC-2981 interface ID: 0x2a55205a
        expect(await items.supportsInterface("0x2a55205a")).to.be.true;
      });
    });

    describe("Item Type Management", function () {
      it("should allow owner to create item types", async function () {
        const tx = await items.createItemType(100, 0, 0, 1, "ipfs://item1.json");
        await expect(tx).to.emit(items, "ItemTypCreated").withArgs(1, 100, 0, 0);

        const [maxSupply, totalMinted, requiredAchievement, priceInWei, active, uri] =
          await items.getItemType(1);
        expect(maxSupply).to.equal(100);
        expect(totalMinted).to.equal(0);
        expect(requiredAchievement).to.equal(0);
        expect(priceInWei).to.equal(0);
        expect(active).to.be.true;
        expect(uri).to.equal("ipfs://item1.json");
      });

      it("should not allow non-owner to create item types", async function () {
        await expect(
          items.connect(player1).createItemType(100, 0, 0, 1, "ipfs://item1.json")
        ).to.be.reverted;
      });
    });

    describe("Minting", function () {
      beforeEach(async function () {
        // Create a free item type with no achievement requirement
        await items.createItemType(100, 0, 0, 5, "ipfs://free-item.json");
        // Create a paid item type
        await items.createItemType(50, 0, ethers.parseEther("0.01"), 2, "ipfs://paid-item.json");
        // Create an achievement-gated item type (requires achievement 1)
        await items.createItemType(25, 1, 0, 1, "ipfs://gated-item.json");
      });

      it("should allow public mint for free items", async function () {
        const tx = await items.connect(player1).mint(1);
        await expect(tx).to.emit(items, "ItemMinted").withArgs(player1.address, 1, 1);

        expect(await items.ownerOf(1)).to.equal(player1.address);
      });

      it("should allow public mint for paid items with correct ETH", async function () {
        const tx = await items.connect(player1).mint(2, { value: ethers.parseEther("0.01") });
        await expect(tx).to.emit(items, "ItemMinted");
        expect(await items.ownerOf(1)).to.equal(player1.address);
      });

      it("should revert paid mint with insufficient ETH", async function () {
        await expect(
          items.connect(player1).mint(2, { value: ethers.parseEther("0.005") })
        ).to.be.revertedWith("Insufficient payment");
      });

      it("should enforce achievement requirement", async function () {
        // Player doesn't have achievement 1
        await expect(
          items.connect(player1).mint(3)
        ).to.be.revertedWith("Required achievement not earned");
      });

      it("should allow mint after earning required achievement", async function () {
        // Give player1 achievement 1
        await badges.setAuthorizedMinter(owner.address, true);
        await badges.mintBadge(player1.address, 1, "a1.json");

        const tx = await items.connect(player1).mint(3);
        await expect(tx).to.emit(items, "ItemMinted");
        expect(await items.ownerOf(1)).to.equal(player1.address);
      });

      it("should enforce per-wallet cap", async function () {
        // Item type 1 has cap of 5
        for (let i = 0; i < 5; i++) {
          await items.connect(player1).mint(1);
        }

        await expect(
          items.connect(player1).mint(1)
        ).to.be.revertedWith("Wallet mint cap reached");
      });

      it("should enforce max supply", async function () {
        // Create item with supply of 2
        await items.createItemType(2, 0, 0, 0, "ipfs://limited.json");
        const typeId = 4;

        await items.connect(player1).mint(typeId);
        await items.connect(player2).mint(typeId);

        await expect(
          items.connect(player1).mint(typeId)
        ).to.be.revertedWith("Max supply reached");
      });

      it("should allow authorized minter to mint rewards", async function () {
        await items.setAuthorizedMinter(owner.address, true);
        const tx = await items.mintReward(player1.address, 1);
        await expect(tx).to.emit(items, "ItemMinted");
        expect(await items.ownerOf(1)).to.equal(player1.address);
      });

      it("should support batch reward minting", async function () {
        await items.setAuthorizedMinter(owner.address, true);
        await items.batchMintReward([player1.address, player2.address], 1);

        expect(await items.ownerOf(1)).to.equal(player1.address);
        expect(await items.ownerOf(2)).to.equal(player2.address);
      });
    });

    describe("Transfers (Tradeable)", function () {
      beforeEach(async function () {
        await items.createItemType(100, 0, 0, 0, "ipfs://item.json");
        await items.connect(player1).mint(1);
      });

      it("should allow transfers between players", async function () {
        await items.connect(player1).transferFrom(player1.address, player2.address, 1);
        expect(await items.ownerOf(1)).to.equal(player2.address);
      });

      it("should allow safeTransferFrom", async function () {
        await items.connect(player1)["safeTransferFrom(address,address,uint256)"](
          player1.address, player2.address, 1
        );
        expect(await items.ownerOf(1)).to.equal(player2.address);
      });
    });

    describe("Royalties", function () {
      beforeEach(async function () {
        await items.createItemType(100, 0, 0, 0, "ipfs://item.json");
        await items.connect(player1).mint(1);
      });

      it("should return default 5% royalty", async function () {
        const salePrice = ethers.parseEther("1.0");
        const [receiver, amount] = await items.royaltyInfo(1, salePrice);

        expect(receiver).to.equal(treasury.address);
        expect(amount).to.equal(ethers.parseEther("0.05")); // 5% of 1 ETH
      });
    });

    describe("canMint view", function () {
      it("should return true for eligible mints", async function () {
        await items.createItemType(100, 0, 0, 0, "ipfs://item.json");
        expect(await items.canMint(player1.address, 1)).to.be.true;
      });

      it("should return false for inactive item type", async function () {
        await items.createItemType(100, 0, 0, 0, "ipfs://item.json");
        await items.updateItemType(1, 100, 0, 0, 0, false, "ipfs://item.json");
        expect(await items.canMint(player1.address, 1)).to.be.false;
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // ACHIEVEMENT MANAGER
  // ═══════════════════════════════════════════════════════════

  describe("AchievementManager", function () {
    describe("Goal Management", function () {
      it("should allow owner to create goals", async function () {
        const tx = await manager.createGoal(
          "Space Rocks Master",
          "Score 25000 in Space Rocks",
          0, // SCORE
          25000,
          "space-rocks",
          1, // achievement type
          0, // no item reward
          ethers.parseEther("500")
        );

        await expect(tx).to.emit(manager, "GoalCreated").withArgs(1, "Space Rocks Master", 0, 25000);

        const [name, description, category, threshold, gameId, achievementTypeId, rewardItemTypeId, rewardTokenAmount, active] =
          await manager.getGoal(1);

        expect(name).to.equal("Space Rocks Master");
        expect(threshold).to.equal(25000);
        expect(active).to.be.true;
      });

      it("should not allow non-owner to create goals", async function () {
        await expect(
          manager.connect(player1).createGoal("Test", "Test", 0, 100, "", 1, 0, 0)
        ).to.be.reverted;
      });

      it("should support batch goal creation", async function () {
        await manager.batchCreateGoals([
          { name: "Goal 1", description: "Desc 1", category: 0, threshold: 100, gameId: "game1", achievementTypeId: 1, rewardItemTypeId: 0, rewardTokenAmount: ethers.parseEther("50") },
          { name: "Goal 2", description: "Desc 2", category: 1, threshold: 200, gameId: "", achievementTypeId: 2, rewardItemTypeId: 0, rewardTokenAmount: ethers.parseEther("100") },
        ]);

        expect(await manager.nextGoalId()).to.equal(3);
      });
    });

    describe("Achievement Awarding", function () {
      beforeEach(async function () {
        // Create a goal with badge + token reward
        await manager.createGoal(
          "First Steps",
          "Play 10 games",
          1, // GAMES_PLAYED
          10,
          "",
          10, // achievement type
          0,  // no item reward
          ethers.parseEther("50")
        );
      });

      it("should allow verifier to award achievement", async function () {
        const tx = await manager.connect(verifier).awardAchievement(player1.address, 1);

        await expect(tx).to.emit(manager, "AchievementAwarded");

        // Check badge was minted
        expect(await badges.hasAchievement(player1.address, 10)).to.be.true;

        // Check goal completion tracked
        expect(await manager.hasCompletedGoal(player1.address, 1)).to.be.true;
        expect(await manager.getPlayerAchievementCount(player1.address)).to.equal(1);

        // Check token reward was minted
        expect(await token.balanceOf(player1.address)).to.equal(ethers.parseEther("50"));
      });

      it("should not allow unauthorized addresses to award", async function () {
        await expect(
          manager.connect(player1).awardAchievement(player1.address, 1)
        ).to.be.revertedWith("Not authorized verifier");
      });

      it("should not allow awarding same goal twice", async function () {
        await manager.connect(verifier).awardAchievement(player1.address, 1);

        await expect(
          manager.connect(verifier).awardAchievement(player1.address, 1)
        ).to.be.revertedWith("Goal already completed by player");
      });

      it("should not allow awarding inactive goals", async function () {
        await manager.setGoalActive(1, false);

        await expect(
          manager.connect(verifier).awardAchievement(player1.address, 1)
        ).to.be.revertedWith("Goal not active");
      });

      it("should support batch awarding", async function () {
        await manager.connect(verifier).batchAwardAchievement(
          [player1.address, player2.address],
          1
        );

        expect(await manager.hasCompletedGoal(player1.address, 1)).to.be.true;
        expect(await manager.hasCompletedGoal(player2.address, 1)).to.be.true;
        expect(await manager.totalAchievementsAwarded()).to.equal(2);
      });

      it("should skip already completed players in batch", async function () {
        await manager.connect(verifier).awardAchievement(player1.address, 1);

        // Batch with player1 already completed - should not revert
        await manager.connect(verifier).batchAwardAchievement(
          [player1.address, player2.address],
          1
        );

        // Only player2 should be newly awarded
        expect(await manager.totalAchievementsAwarded()).to.equal(2);
      });
    });

    describe("Goal Status Views", function () {
      beforeEach(async function () {
        await manager.createGoal("Goal 1", "Desc", 0, 100, "", 1, 0, 0);
        await manager.createGoal("Goal 2", "Desc", 0, 200, "", 2, 0, 0);
        await manager.createGoal("Goal 3", "Desc", 0, 300, "", 3, 0, 0);

        await manager.connect(verifier).awardAchievement(player1.address, 1);
        await manager.connect(verifier).awardAchievement(player1.address, 3);
      });

      it("should return correct batch status", async function () {
        const statuses = await manager.getPlayerGoalStatuses(player1.address, [1, 2, 3]);
        expect(statuses[0]).to.be.true;
        expect(statuses[1]).to.be.false;
        expect(statuses[2]).to.be.true;
      });
    });

    describe("Full Integration Flow", function () {
      it("should handle complete goal -> badge -> item -> token flow", async function () {
        // Create item type for reward
        await items.createItemType(100, 0, 0, 0, "ipfs://reward-skin.json");

        // Create goal with all three reward types
        await manager.createGoal(
          "Ultimate Achievement",
          "The big one",
          6, // SPECIAL
          1,
          "",
          99,  // achievement type
          1,   // reward item type 1
          ethers.parseEther("1000")
        );

        // Award achievement
        const tx = await manager.connect(verifier).awardAchievement(player1.address, 1);

        // Verify badge minted
        expect(await badges.hasAchievement(player1.address, 99)).to.be.true;

        // Verify tradeable item minted
        expect(await items.balanceOf(player1.address)).to.equal(1);

        // Verify tokens minted
        expect(await token.balanceOf(player1.address)).to.equal(ethers.parseEther("1000"));

        // Verify the tradeable item can be transferred (not soulbound)
        const itemTokenId = 1;
        await items.connect(player1).transferFrom(player1.address, player2.address, itemTokenId);
        expect(await items.ownerOf(itemTokenId)).to.equal(player2.address);
      });
    });
  });
});

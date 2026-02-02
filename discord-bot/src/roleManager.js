const { ROLES, MESSAGE_THRESHOLDS, GAME_THRESHOLDS, HOLDER_THRESHOLDS, LEVEL_99_REQUIREMENTS, OG_CUTOFF_DATE } = require('./config');
const firebase = require('./firebase');
const { ethers } = require('ethers');

// Token contract for balance checks
const TOKEN_ADDRESS = '0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d';
const TOKEN_ABI = ['function balanceOf(address) view returns (uint256)'];
const RPC_URL = 'https://sepolia-rollup.arbitrum.io/rpc';
const RPC_TIMEOUT = 5000; // 5 second timeout for RPC calls

// Singleton provider instance
let provider = null;
function getProvider() {
  if (!provider) {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  }
  return provider;
}

// Helper to add timeout to promises
function withTimeout(promise, ms, errorMessage = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
  ]);
}

// Check token balance with timeout protection
async function getTokenBalance(walletAddress) {
  try {
    const contract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, getProvider());
    const balance = await withTimeout(
      contract.balanceOf(walletAddress),
      RPC_TIMEOUT,
      'RPC call timed out'
    );
    return parseFloat(ethers.utils.formatEther(balance));
  } catch (error) {
    console.error('Error checking token balance:', error.message);
    return 0;
  }
}

// Get roles a user should have based on their activity
async function calculateUserRoles(discordId, member) {
  const rolesToAdd = [];
  const rolesToRemove = [];
  const achievedRoles = new Set(); // Track which roles user has earned

  // Get Discord activity
  const discordActivity = await firebase.getDiscordActivity(discordId);
  const messageCount = discordActivity?.messageCount || 0;

  // Get linked wallet (if any)
  const walletAddress = await firebase.getLinkedWallet(discordId);

  // === DISCORD ROLES ===

  // Noob (everyone gets this on join)
  if (ROLES.NOOB?.id) {
    rolesToAdd.push(ROLES.NOOB.id);
    achievedRoles.add('NOOB');
  }

  // Message-based roles
  for (const threshold of MESSAGE_THRESHOLDS) {
    if (messageCount >= threshold.count) {
      const role = ROLES[threshold.role];
      if (role?.id) {
        rolesToAdd.push(role.id);
        achievedRoles.add(threshold.role);
      }
    }
  }

  // Arcade OG (joined before cutoff)
  if (ROLES.ARCADE_OG?.id && member.joinedAt < OG_CUTOFF_DATE) {
    rolesToAdd.push(ROLES.ARCADE_OG.id);
    achievedRoles.add('ARCADE_OG');
  }

  // === GAME ROLES (requires linked wallet) ===
  let gamesPlayed = 0;
  let balance = 0;

  if (walletAddress) {
    const gameStats = await firebase.getGameStats(walletAddress);

    if (gameStats) {
      gamesPlayed = gameStats.totalGamesPlayed || 0;

      // Game count roles
      for (const threshold of GAME_THRESHOLDS) {
        if (gamesPlayed >= threshold.count) {
          const role = ROLES[threshold.role];
          if (role?.id) {
            rolesToAdd.push(role.id);
            achievedRoles.add(threshold.role);
          }
        }
      }

      // Daily Final Boss
      if (ROLES.DAILY_FINAL_BOSS?.id) {
        const isTop10 = await firebase.checkDailyTop10(walletAddress);
        if (isTop10) {
          rolesToAdd.push(ROLES.DAILY_FINAL_BOSS.id);
          achievedRoles.add('DAILY_FINAL_BOSS');
        }
      }

      // Tournament Champion
      if (ROLES.TOURNAMENT_CHAMPION?.id) {
        const hasTournamentWin = await firebase.checkTournamentWins(walletAddress);
        if (hasTournamentWin) {
          rolesToAdd.push(ROLES.TOURNAMENT_CHAMPION.id);
          achievedRoles.add('TOURNAMENT_CHAMPION');
        }
      }
    }

    // === HOLDER ROLES ===
    balance = await getTokenBalance(walletAddress);

    for (const threshold of HOLDER_THRESHOLDS) {
      if (balance >= threshold.amount) {
        const role = ROLES[threshold.role];
        if (role?.id) {
          rolesToAdd.push(role.id);
          achievedRoles.add(threshold.role);
        }
      }
    }
  }

  // === EPIC ROLES ===

  // Level 99 - Check if user has ALL required roles
  if (ROLES.LEVEL_99?.id) {
    const hasAllRequirements = LEVEL_99_REQUIREMENTS.every(req => achievedRoles.has(req));
    if (hasAllRequirements) {
      rolesToAdd.push(ROLES.LEVEL_99.id);
      achievedRoles.add('LEVEL_99');
      console.log(`🌟 ${member.user.tag} qualified for Level 99!`);
    }
  }

  return { rolesToAdd: [...new Set(rolesToAdd)], rolesToRemove, achievedRoles };
}

// Sync roles for a single user
async function syncUserRoles(member) {
  const discordId = member.id;

  try {
    const { rolesToAdd, rolesToRemove } = await calculateUserRoles(discordId, member);

    // Add missing roles
    for (const roleId of rolesToAdd) {
      if (roleId && !member.roles.cache.has(roleId)) {
        try {
          await member.roles.add(roleId);
          console.log(`✅ Added role ${roleId} to ${member.user.tag}`);
        } catch (e) {
          console.error(`❌ Failed to add role ${roleId}:`, e.message);
        }
      }
    }

    // Remove roles (if needed)
    for (const roleId of rolesToRemove) {
      if (roleId && member.roles.cache.has(roleId)) {
        try {
          await member.roles.remove(roleId);
          console.log(`🔻 Removed role ${roleId} from ${member.user.tag}`);
        } catch (e) {
          console.error(`❌ Failed to remove role ${roleId}:`, e.message);
        }
      }
    }

    return { success: true, rolesAdded: rolesToAdd.length };
  } catch (error) {
    console.error(`Error syncing roles for ${member.user.tag}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Calculate airdrop points for a user
async function calculateAirdropPoints(discordId) {
  let totalPoints = 0;
  const breakdown = [];

  const discordActivity = await firebase.getDiscordActivity(discordId);
  const walletAddress = await firebase.getLinkedWallet(discordId);

  // Discord activity points
  const messageCount = discordActivity?.messageCount || 0;

  for (const threshold of MESSAGE_THRESHOLDS) {
    if (messageCount >= threshold.count) {
      const role = ROLES[threshold.role];
      if (role) {
        totalPoints += role.points;
        breakdown.push({ role: role.name, points: role.points });
      }
    }
  }

  // Game activity points (if wallet linked)
  if (walletAddress) {
    const gameStats = await firebase.getGameStats(walletAddress);

    if (gameStats) {
      for (const threshold of GAME_THRESHOLDS) {
        if (gameStats.totalGamesPlayed >= threshold.count) {
          const role = ROLES[threshold.role];
          if (role) {
            totalPoints += role.points;
            breakdown.push({ role: role.name, points: role.points });
          }
        }
      }

      // Check special achievements
      if (await firebase.checkDailyTop10(walletAddress)) {
        totalPoints += ROLES.DAILY_FINAL_BOSS.points;
        breakdown.push({ role: ROLES.DAILY_FINAL_BOSS.name, points: ROLES.DAILY_FINAL_BOSS.points });
      }

      if (await firebase.checkTournamentWins(walletAddress)) {
        totalPoints += ROLES.TOURNAMENT_CHAMPION.points;
        breakdown.push({ role: ROLES.TOURNAMENT_CHAMPION.name, points: ROLES.TOURNAMENT_CHAMPION.points });
      }
    }

    // Holder points
    const balance = await getTokenBalance(walletAddress);

    for (const threshold of HOLDER_THRESHOLDS) {
      if (balance >= threshold.amount) {
        const role = ROLES[threshold.role];
        if (role) {
          totalPoints += role.points;
          breakdown.push({ role: role.name, points: role.points });
        }
      }
    }

    // Level 99 bonus (if they have all requirements)
    const hasKeyboardOverlord = messageCount >= 500;
    const hasPixelOverlord = gameStats?.totalGamesPlayed >= 500;
    const hasHolder = balance >= 1;

    if (hasKeyboardOverlord && hasPixelOverlord && hasHolder) {
      totalPoints += ROLES.LEVEL_99.points;
      breakdown.push({ role: ROLES.LEVEL_99.name, points: ROLES.LEVEL_99.points });
    }
  }

  return { totalPoints, breakdown, messageCount, walletAddress };
}

module.exports = {
  calculateUserRoles,
  syncUserRoles,
  calculateAirdropPoints,
  getTokenBalance
};

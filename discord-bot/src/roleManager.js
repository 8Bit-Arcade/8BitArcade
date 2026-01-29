const { ROLES, MESSAGE_THRESHOLDS, GAME_THRESHOLDS, OG_CUTOFF_DATE } = require('./config');
const firebase = require('./firebase');
const { ethers } = require('ethers');

// Token contract for balance checks
const TOKEN_ADDRESS = '0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d';
const TOKEN_ABI = ['function balanceOf(address) view returns (uint256)'];
const RPC_URL = 'https://sepolia-rollup.arbitrum.io/rpc';

// Check token balance
async function getTokenBalance(walletAddress) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);
    const balance = await contract.balanceOf(walletAddress);
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

  // Get Discord activity
  const discordActivity = await firebase.getDiscordActivity(discordId);
  const messageCount = discordActivity?.messageCount || 0;

  // Get linked wallet (if any)
  const walletAddress = await firebase.getLinkedWallet(discordId);

  // === DISCORD ROLES ===

  // Player 1 (everyone gets this)
  if (ROLES.PLAYER_1.id) {
    rolesToAdd.push(ROLES.PLAYER_1.id);
  }

  // Message-based roles
  for (const threshold of MESSAGE_THRESHOLDS) {
    if (threshold.count > 0 && messageCount >= threshold.count) {
      const role = ROLES[threshold.role];
      if (role?.id) rolesToAdd.push(role.id);
    }
  }

  // OG Gamer (joined before cutoff)
  if (ROLES.OG_GAMER.id && member.joinedAt < OG_CUTOFF_DATE) {
    rolesToAdd.push(ROLES.OG_GAMER.id);
  }

  // === GAME ROLES (requires linked wallet) ===
  if (walletAddress) {
    const gameStats = await firebase.getGameStats(walletAddress);

    if (gameStats) {
      const gamesPlayed = gameStats.totalGamesPlayed || 0;

      // Game count roles
      for (const threshold of GAME_THRESHOLDS) {
        if (gamesPlayed >= threshold.count) {
          const role = ROLES[threshold.role];
          if (role?.id) rolesToAdd.push(role.id);
        }
      }

      // Daily Top 10
      if (ROLES.DAILY_TOP_10.id) {
        const isTop10 = await firebase.checkDailyTop10(walletAddress);
        if (isTop10) rolesToAdd.push(ROLES.DAILY_TOP_10.id);
      }

      // Tournament Victor
      if (ROLES.TOURNAMENT_VICTOR.id) {
        const hasTournamentWin = await firebase.checkTournamentWins(walletAddress);
        if (hasTournamentWin) rolesToAdd.push(ROLES.TOURNAMENT_VICTOR.id);
      }
    }

    // === HOLDER ROLES ===
    const balance = await getTokenBalance(walletAddress);

    if (ROLES.TOKEN_HOLDER.id && balance >= 1) {
      rolesToAdd.push(ROLES.TOKEN_HOLDER.id);
    }

    if (ROLES.WHALE.id && balance >= 100000) {
      rolesToAdd.push(ROLES.WHALE.id);
    }
  }

  return { rolesToAdd: [...new Set(rolesToAdd)], rolesToRemove };
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
      totalPoints += role.points;
      breakdown.push({ role: role.name, points: role.points });
    }
  }

  // Game activity points (if wallet linked)
  if (walletAddress) {
    const gameStats = await firebase.getGameStats(walletAddress);

    if (gameStats) {
      for (const threshold of GAME_THRESHOLDS) {
        if (gameStats.totalGamesPlayed >= threshold.count) {
          const role = ROLES[threshold.role];
          totalPoints += role.points;
          breakdown.push({ role: role.name, points: role.points });
        }
      }

      // Check special achievements
      if (await firebase.checkDailyTop10(walletAddress)) {
        totalPoints += ROLES.DAILY_TOP_10.points;
        breakdown.push({ role: ROLES.DAILY_TOP_10.name, points: ROLES.DAILY_TOP_10.points });
      }

      if (await firebase.checkTournamentWins(walletAddress)) {
        totalPoints += ROLES.TOURNAMENT_VICTOR.points;
        breakdown.push({ role: ROLES.TOURNAMENT_VICTOR.name, points: ROLES.TOURNAMENT_VICTOR.points });
      }
    }

    // Holder points
    const balance = await getTokenBalance(walletAddress);
    if (balance >= 1) {
      totalPoints += ROLES.TOKEN_HOLDER.points;
      breakdown.push({ role: ROLES.TOKEN_HOLDER.name, points: ROLES.TOKEN_HOLDER.points });
    }
    if (balance >= 100000) {
      totalPoints += ROLES.WHALE.points;
      breakdown.push({ role: ROLES.WHALE.name, points: ROLES.WHALE.points });
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

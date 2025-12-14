/**
 * Discord Webhook Integration for Winner Announcements
 *
 * Posts daily winners to Discord channel with wallet addresses
 * for transparency and proof of legitimate payouts.
 */

import * as functions from 'firebase-functions';

interface Winner {
  rank: number;
  address: string;
  score: number;
  reward: string; // Amount of tokens earned
  displayName?: string; // Username, ENS, or address based on user preference
}

interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: DiscordEmbedField[];
  footer?: {
    text: string;
  };
  timestamp?: string;
}

interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
}

/**
 * Post winners to Discord webhook
 *
 * @param winners - Array of winner objects with rank, address, score, reward
 * @param gameName - Name of the game (or "All Games" for combined)
 * @param txHash - Transaction hash for blockchain verification
 * @param dayId - Day ID (YYYYMMDD format)
 * @param networkExplorerUrl - Base URL for blockchain explorer (e.g., Arbiscan)
 */
export async function postWinnersToDiscord(
  winners: Winner[],
  gameName: string,
  txHash: string,
  dayId: number,
  networkExplorerUrl: string = 'https://arbiscan.io'
): Promise<void> {
  try {
    // Get Discord webhook URL from Firebase config
    const webhookUrl = functions.config().discord?.webhook_url;

    if (!webhookUrl) {
      console.warn('Discord webhook URL not configured. Skipping Discord notification.');
      console.info('To enable, run: firebase functions:config:set discord.webhook_url="YOUR_WEBHOOK_URL"');
      return;
    }

    // Build winner list for embed
    const winnerFields: DiscordEmbedField[] = winners.map(w => {
      const displayName = w.displayName || w.address;
      const showAddress = w.displayName && w.displayName !== w.address;

      return {
        name: `${getRankEmoji(w.rank)} Rank #${w.rank} - ${w.reward} 8BIT`,
        value: showAddress
          ? `**${displayName}**\n\`${w.address}\`\nScore: ${w.score.toLocaleString()}`
          : `\`${w.address}\`\nScore: ${w.score.toLocaleString()}`,
        inline: false,
      };
    });

    // Create embed with winner information
    const embed: DiscordEmbed = {
      title: `🎮 Daily Winners - ${gameName}`,
      description: `**Day:** ${formatDayId(dayId)}\n**Rewards distributed on-chain**`,
      color: 0x00ff88, // Green color
      fields: [
        ...winnerFields,
        {
          name: '📋 Blockchain Proof',
          value: `[View Transaction on Arbiscan](${networkExplorerUrl}/tx/${txHash})`,
          inline: false,
        },
      ],
      footer: {
        text: '8-Bit Arcade • Transparent & Verifiable Rewards',
      },
      timestamp: new Date().toISOString(),
    };

    const payload: DiscordWebhookPayload = {
      content: '🎉 **Daily rewards have been distributed!**',
      embeds: [embed],
    };

    // Send to Discord
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord webhook failed: ${response.status} - ${errorText}`);
    }

    console.log(`✅ Posted ${winners.length} winners to Discord for ${gameName}`);

  } catch (error) {
    console.error('Error posting to Discord:', error);
    // Don't throw - we don't want Discord issues to break reward distribution
  }
}

/**
 * Post multiple games' winners to Discord (combined announcement)
 */
export async function postAllGamesWinnersToDiscord(
  gameWinners: { gameName: string; winners: Winner[] }[],
  txHash: string,
  dayId: number,
  totalRewardsDistributed: string,
  networkExplorerUrl: string = 'https://arbiscan.io'
): Promise<void> {
  try {
    const webhookUrl = functions.config().discord?.webhook_url;

    if (!webhookUrl) {
      console.warn('Discord webhook URL not configured.');
      return;
    }

    // Create embeds for each game
    const embeds: DiscordEmbed[] = gameWinners.map(({ gameName, winners }) => {
      const winnerFields: DiscordEmbedField[] = winners.slice(0, 3).map(w => {
        const displayName = w.displayName || w.address;
        const showAddress = w.displayName && w.displayName !== w.address;

        return {
          name: `${getRankEmoji(w.rank)} Rank #${w.rank} - ${w.reward} 8BIT`,
          value: showAddress ? `**${displayName}**\n\`${w.address}\`` : `\`${w.address}\``,
          inline: true,
        };
      });

      return {
        title: `🎮 ${gameName}`,
        color: 0x00d4ff, // Cyan
        fields: winnerFields,
      };
    });

    // Add summary embed at the end
    const summaryEmbed: DiscordEmbed = {
      title: '📊 Distribution Summary',
      color: 0x00ff88,
      fields: [
        {
          name: 'Total Distributed',
          value: `**${totalRewardsDistributed} 8BIT**`,
          inline: true,
        },
        {
          name: 'Date',
          value: formatDayId(dayId),
          inline: true,
        },
        {
          name: '📋 Blockchain Proof',
          value: `[View on Arbiscan](${networkExplorerUrl}/tx/${txHash})`,
          inline: false,
        },
      ],
      footer: {
        text: '8-Bit Arcade • All payouts verified on-chain',
      },
      timestamp: new Date().toISOString(),
    };

    embeds.push(summaryEmbed);

    const payload: DiscordWebhookPayload = {
      content: `🎉 **Daily Rewards Distributed - ${formatDayId(dayId)}**\n\nTop 10 players per game have been rewarded!`,
      embeds,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord webhook failed: ${response.status} - ${errorText}`);
    }

    console.log(`✅ Posted winners for ${gameWinners.length} games to Discord`);

  } catch (error) {
    console.error('Error posting to Discord:', error);
  }
}

/**
 * Format day ID (YYYYMMDD) to readable date
 */
function formatDayId(dayId: number): string {
  const dateStr = dayId.toString();
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);

  return `${year}-${month}-${day}`;
}

/**
 * Get emoji for rank
 */
function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '🏆';
  }
}

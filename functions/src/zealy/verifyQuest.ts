import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

interface ZealyVerifyResponse {
  success: boolean;
  verified: boolean;
  message: string;
  data?: {
    gamesPlayed: number;
    required: number;
    wallet: string;
    tokensPurchased?: number;
    tokensRequired?: number;
  };
}

/**
 * HTTP endpoint for Zealy quest verification
 *
 * Zealy calls this endpoint to verify if a user has completed a quest requirement.
 *
 * Usage:
 *   GET /zealyVerifyQuest?wallet=0x123...&quest=games3
 *
 * Query Parameters:
 *   - wallet: The player's wallet address (required)
 *   - quest: The quest type to verify (required)
 *     - "games3": Verify player has played 3+ games (main quest)
 *     - "games5": Verify player has played 5+ games
 *     - "games10": Verify player has played 10+ games
 *     - "tournament1": Verify player has entered 1+ tournament
 *
 * Response:
 *   { success: true, verified: true/false, message: "...", data: {...} }
 */
export const zealyVerifyQuest = onRequest(
  { cors: true },
  async (req, res) => {
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Accept GET or POST
    const wallet = (req.query.wallet || req.body?.wallet) as string;
    const quest = (req.query.quest || req.body?.quest) as string;

    if (!wallet) {
      const response: ZealyVerifyResponse = {
        success: false,
        verified: false,
        message: 'Missing wallet parameter',
      };
      res.status(400).json(response);
      return;
    }

    if (!quest) {
      const response: ZealyVerifyResponse = {
        success: false,
        verified: false,
        message: 'Missing quest parameter. Valid options: games3, games5, games10, tournament1, sale30k, sale60k',
      };
      res.status(400).json(response);
      return;
    }

    try {
      const normalizedWallet = wallet.toLowerCase();

      // Sale quests check sale_buyers, not the users collection
      const isSaleQuest = quest === 'sale30k' || quest === 'sale60k';

      // Get user document (only needed for game/tournament quests)
      let gamesPlayed = 0;
      if (!isSaleQuest) {
        const userDoc = await db.collection('users').doc(normalizedWallet).get();

        if (!userDoc.exists) {
          const response: ZealyVerifyResponse = {
            success: true,
            verified: false,
            message: 'Player not found - no games played yet',
            data: {
              gamesPlayed: 0,
              required: getRequiredCount(quest),
              wallet: normalizedWallet,
            },
          };
          res.json(response);
          return;
        }

        gamesPlayed = userDoc.data()?.totalGamesPlayed || 0;
      }

      // Handle different quest types
      switch (quest) {
        case 'games3': {
          const required = 3;
          const verified = gamesPlayed >= required;
          const response: ZealyVerifyResponse = {
            success: true,
            verified,
            message: verified
              ? `Quest complete! Player has played ${gamesPlayed} games.`
              : `Not yet complete. Player has ${gamesPlayed}/${required} games.`,
            data: {
              gamesPlayed,
              required,
              wallet: normalizedWallet,
            },
          };
          res.json(response);
          return;
        }

        case 'games5': {
          const required = 5;
          const verified = gamesPlayed >= required;
          const response: ZealyVerifyResponse = {
            success: true,
            verified,
            message: verified
              ? `Quest complete! Player has played ${gamesPlayed} games.`
              : `Not yet complete. Player has ${gamesPlayed}/${required} games.`,
            data: {
              gamesPlayed,
              required,
              wallet: normalizedWallet,
            },
          };
          res.json(response);
          return;
        }

        case 'games10': {
          const required = 10;
          const verified = gamesPlayed >= required;
          const response: ZealyVerifyResponse = {
            success: true,
            verified,
            message: verified
              ? `Quest complete! Player has played ${gamesPlayed} games.`
              : `Not yet complete. Player has ${gamesPlayed}/${required} games.`,
            data: {
              gamesPlayed,
              required,
              wallet: normalizedWallet,
            },
          };
          res.json(response);
          return;
        }

        case 'tournament1': {
          // Check tournament entries
          const tournamentsSnapshot = await db
            .collectionGroup('entries')
            .where('player', '==', normalizedWallet)
            .limit(1)
            .get();

          const tournamentEntries = tournamentsSnapshot.size;
          const required = 1;
          const verified = tournamentEntries >= required;

          const response: ZealyVerifyResponse = {
            success: true,
            verified,
            message: verified
              ? `Quest complete! Player has entered ${tournamentEntries} tournament(s).`
              : `Not yet complete. Player has ${tournamentEntries}/${required} tournament entries.`,
            data: {
              gamesPlayed: tournamentEntries,
              required,
              wallet: normalizedWallet,
            },
          };
          res.json(response);
          return;
        }

        case 'sale30k':
        case 'sale60k': {
          // Tokens are stored in wei (18 decimals) as a float in sale_buyers.totalTokens
          const requiredTokens = quest === 'sale30k' ? 30_000 : 60_000;
          const requiredWei = requiredTokens * 1e18;

          const buyerDoc = await db.collection('sale_buyers').doc(normalizedWallet).get();
          const totalTokensWei: number = buyerDoc.exists
            ? (buyerDoc.data()?.totalTokens || 0)
            : 0;
          const totalTokens = totalTokensWei / 1e18;
          const verified = totalTokensWei >= requiredWei;

          const response: ZealyVerifyResponse = {
            success: true,
            verified,
            message: verified
              ? `Quest complete! Wallet purchased ${totalTokens.toLocaleString()} 8BIT tokens.`
              : `Not yet complete. Wallet purchased ${totalTokens.toLocaleString()}/${requiredTokens.toLocaleString()} 8BIT tokens.`,
            data: {
              gamesPlayed: 0,
              required: requiredTokens,
              wallet: normalizedWallet,
              tokensPurchased: totalTokens,
              tokensRequired: requiredTokens,
            },
          };
          res.json(response);
          return;
        }

        default: {
          const response: ZealyVerifyResponse = {
            success: false,
            verified: false,
            message: `Unknown quest type: ${quest}. Valid options: games3, games5, games10, tournament1, sale30k, sale60k`,
          };
          res.status(400).json(response);
          return;
        }
      }
    } catch (error) {
      console.error('Error verifying Zealy quest:', error);
      const response: ZealyVerifyResponse = {
        success: false,
        verified: false,
        message: 'Internal error verifying quest',
      };
      res.status(500).json(response);
    }
  }
);

function getRequiredCount(quest: string): number {
  switch (quest) {
    case 'games3':
      return 3;
    case 'games5':
      return 5;
    case 'games10':
      return 10;
    case 'tournament1':
      return 1;
    case 'sale30k':
      return 30_000;
    case 'sale60k':
      return 60_000;
    default:
      return 0;
  }
}

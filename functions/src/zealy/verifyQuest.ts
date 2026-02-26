import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { JsonRpcProvider, Contract } from 'ethers';

const db = getFirestore();

const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';
const ACHIEVEMENT_BADGES_ADDRESS = '0x8dE45E3e37f0721D64d63E32da5f37CfaCF9ca9f';
const ERC721_BALANCE_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
];

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
 * Zealy sends a POST request when a user claims an API task.
 * The endpoint checks if the requirement is met and returns 200 (pass) or 400 (fail).
 *
 * Zealy POST body:
 *   { accounts: { wallet: "0x..." }, userId, communityId, subdomain, questId, requestId }
 *
 * Also supports direct calls:
 *   GET /zealyVerifyQuest?wallet=0x123...&quest=nft7
 *
 * Quest types:
 *   - "games3": Played 3+ games
 *   - "games5": Played 5+ games
 *   - "games10": Played 10+ games
 *   - "tournament1": Entered 1+ tournament
 *   - "sale30k": Purchased 30,000+ 8BIT tokens
 *   - "sale60k": Purchased 60,000+ 8BIT tokens
 *   - "nft7": Holds 7+ Achievement Badge NFTs
 *
 * Configure in Zealy:
 *   1. Create quest -> Add task -> API
 *   2. Endpoint: https://<project>.web.app/api/zealy/verify?quest=nft7
 *   3. User identification: Wallet address
 *   4. Optionally set an API key for security
 */
export const zealyVerifyQuest = onRequest(
  { cors: true },
  async (req, res) => {
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Extract wallet: Zealy POST body (accounts.wallet) or query param / direct body
    const wallet = (
      req.query.wallet ||
      req.body?.accounts?.wallet ||
      req.body?.wallet
    ) as string;
    const quest = (req.query.quest || req.body?.quest) as string;

    if (!wallet) {
      res.status(400).json({ message: 'Missing wallet address' });
      return;
    }

    if (!quest) {
      res.status(400).json({
        message: 'Missing quest parameter. Valid options: games3, games5, games10, tournament1, sale30k, sale60k, nft7',
      });
      return;
    }

    try {
      const normalizedWallet = wallet.toLowerCase();

      // Sale/NFT quests don't use the users collection
      const isSaleQuest = quest === 'sale30k' || quest === 'sale60k';
      const isNftQuest = quest === 'nft7';

      // Get user document (only needed for game/tournament quests)
      let gamesPlayed = 0;
      if (!isSaleQuest && !isNftQuest) {
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
        case 'nft7': {
          // Check on-chain Achievement Badge NFT balance
          const provider = new JsonRpcProvider(ARBITRUM_SEPOLIA_RPC);
          const badges = new Contract(ACHIEVEMENT_BADGES_ADDRESS, ERC721_BALANCE_ABI, provider);
          const balance: bigint = await badges.balanceOf(wallet);
          const nftCount = Number(balance);
          const required = 5;
          const verified = nftCount >= required;

          if (verified) {
            res.status(200).json({
              message: `Quest complete! Player holds ${nftCount} Achievement Badge NFTs.`,
              data: { nftBalance: nftCount, required, wallet: normalizedWallet },
            });
          } else {
            res.status(400).json({
              message: `Not yet complete. Player holds ${nftCount}/${required} Achievement Badge NFTs.`,
              data: { nftBalance: nftCount, required, wallet: normalizedWallet },
            });
          }
          return;
        }

        case 'sale30k':
        case 'sale60k': {
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

        case 'games3':
        case 'games5':
        case 'games10': {
          const required = quest === 'games3' ? 3 : quest === 'games5' ? 5 : 10;
          const verified = gamesPlayed >= required;

          if (verified) {
            res.status(200).json({
              message: `Quest complete! Player has played ${gamesPlayed} games.`,
              data: { gamesPlayed, required, wallet: normalizedWallet },
            });
          } else {
            res.status(400).json({
              message: `Not yet complete. Player has ${gamesPlayed}/${required} games.`,
              data: { gamesPlayed, required, wallet: normalizedWallet },
            });
          }
          return;
        }

        case 'tournament1': {
          const tournamentsSnapshot = await db
            .collectionGroup('entries')
            .where('player', '==', normalizedWallet)
            .limit(1)
            .get();
          const tournamentEntries = tournamentsSnapshot.size;
          const required = 1;
          const verified = tournamentEntries >= required;

          if (verified) {
            res.status(200).json({
              message: `Quest complete! Player has entered ${tournamentEntries} tournament(s).`,
              data: { gamesPlayed: tournamentEntries, required, wallet: normalizedWallet },
            });
          } else {
            res.status(400).json({
              message: `Not yet complete. Player has ${tournamentEntries}/${required} tournament entries.`,
              data: { gamesPlayed: tournamentEntries, required, wallet: normalizedWallet },
            });
          }
          return;
        }

        default: {
          const response: ZealyVerifyResponse = {
            success: false,
            verified: false,
            message: `Unknown quest type: ${quest}. Valid options: games3, games5, games10, tournament1, sale30k, sale60k, nft7`,
          };
          res.status(400).json(response);
          return;
        }
      }
    } catch (error) {
      console.error('Error verifying Zealy quest:', error);
      res.status(400).json({ message: 'Internal error verifying quest' });
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
    case 'nft7':
      return 7;
    default:
      return 0;
  }
}

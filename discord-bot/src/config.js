require('dotenv').config();

// Role configuration with thresholds and airdrop points
const ROLES = {
  // Discord Activity Roles
  PLAYER_1: {
    id: process.env.ROLE_PLAYER_1,
    name: 'Player 1',
    emoji: '🕹️',
    type: 'discord',
    threshold: 0, // Just join
    points: 5,
    color: '#00d4ff'
  },
  ARCADE_REGULAR: {
    id: process.env.ROLE_ARCADE_REGULAR,
    name: 'Arcade Regular',
    emoji: '🎮',
    type: 'discord',
    threshold: 50, // 50+ messages
    points: 25,
    color: '#ff00ff'
  },
  HIGH_SCORER: {
    id: process.env.ROLE_HIGH_SCORER,
    name: 'High Scorer',
    emoji: '👾',
    type: 'discord',
    threshold: 200, // 200+ messages
    points: 50,
    color: '#00ff88'
  },
  LEADERBOARD_LEGEND: {
    id: process.env.ROLE_LEADERBOARD_LEGEND,
    name: 'Leaderboard Legend',
    emoji: '🏆',
    type: 'discord',
    threshold: 500, // 500+ messages
    points: 100,
    color: '#ffff00'
  },
  OG_GAMER: {
    id: process.env.ROLE_OG_GAMER,
    name: 'OG Gamer',
    emoji: '⭐',
    type: 'discord',
    threshold: 'og', // Joined before cutoff
    points: 150,
    color: '#ff6600'
  },

  // Game Activity Roles
  FIRST_BLOOD: {
    id: process.env.ROLE_FIRST_BLOOD,
    name: 'First Blood',
    emoji: '🎯',
    type: 'game',
    threshold: 1, // 1+ games
    points: 10,
    color: '#00d4ff'
  },
  GETTING_WARMED_UP: {
    id: process.env.ROLE_GETTING_WARMED_UP,
    name: 'Getting Warmed Up',
    emoji: '🔥',
    type: 'game',
    threshold: 25, // 25+ games
    points: 25,
    color: '#ff00ff'
  },
  DEDICATED_PLAYER: {
    id: process.env.ROLE_DEDICATED_PLAYER,
    name: 'Dedicated Player',
    emoji: '💪',
    type: 'game',
    threshold: 100, // 100+ games
    points: 75,
    color: '#00ff88'
  },
  ARCADE_VETERAN: {
    id: process.env.ROLE_ARCADE_VETERAN,
    name: 'Arcade Veteran',
    emoji: '🎖️',
    type: 'game',
    threshold: 500, // 500+ games
    points: 150,
    color: '#ffff00'
  },
  DAILY_TOP_10: {
    id: process.env.ROLE_DAILY_TOP_10,
    name: 'Daily Top 10',
    emoji: '🏅',
    type: 'game',
    threshold: 'leaderboard', // Hit daily top 10
    points: 50,
    color: '#ff6600'
  },
  TOURNAMENT_VICTOR: {
    id: process.env.ROLE_TOURNAMENT_VICTOR,
    name: 'Tournament Victor',
    emoji: '🥇',
    type: 'game',
    threshold: 'tournament', // Won a tournament
    points: 200,
    color: '#ffd700'
  },

  // Token Holder Roles
  TOKEN_HOLDER: {
    id: process.env.ROLE_TOKEN_HOLDER,
    name: 'Token Holder',
    emoji: '💎',
    type: 'holder',
    threshold: 1, // Any 8BIT
    points: 50,
    color: '#9933ff'
  },
  WHALE: {
    id: process.env.ROLE_WHALE,
    name: 'Whale',
    emoji: '🔥',
    type: 'holder',
    threshold: 100000, // 100k+ 8BIT
    points: 100,
    color: '#ffd700'
  }
};

// Discord message thresholds for role progression
const MESSAGE_THRESHOLDS = [
  { count: 0, role: 'PLAYER_1' },
  { count: 50, role: 'ARCADE_REGULAR' },
  { count: 200, role: 'HIGH_SCORER' },
  { count: 500, role: 'LEADERBOARD_LEGEND' }
];

// Game thresholds for role progression
const GAME_THRESHOLDS = [
  { count: 1, role: 'FIRST_BLOOD' },
  { count: 25, role: 'GETTING_WARMED_UP' },
  { count: 100, role: 'DEDICATED_PLAYER' },
  { count: 500, role: 'ARCADE_VETERAN' }
];

// Token holder thresholds
const HOLDER_THRESHOLDS = [
  { amount: 1, role: 'TOKEN_HOLDER' },
  { amount: 100000, role: 'WHALE' }
];

module.exports = {
  ROLES,
  MESSAGE_THRESHOLDS,
  GAME_THRESHOLDS,
  HOLDER_THRESHOLDS,
  DISCORD_TOKEN: process.env.DISCORD_BOT_TOKEN,
  CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  GUILD_ID: process.env.DISCORD_GUILD_ID,
  OG_CUTOFF_DATE: new Date(process.env.OG_CUTOFF_DATE || '2025-06-01')
};

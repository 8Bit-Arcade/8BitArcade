require('dotenv').config();

// Role configuration with thresholds and airdrop points
const ROLES = {
  // Discord Activity Roles
  NOOB: {
    id: process.env.ROLE_NOOB,
    name: 'Noob',
    emoji: '🕹️',
    type: 'discord',
    threshold: 0, // Just join
    points: 5,
    color: '#00d4ff'
  },
  PLAYER_1: {
    id: process.env.ROLE_PLAYER_1,
    name: 'Player 1',
    emoji: '🎮',
    type: 'discord',
    threshold: 50, // 50+ messages
    points: 25,
    color: '#ff00ff'
  },
  KEYBOARD_WARRIOR: {
    id: process.env.ROLE_KEYBOARD_WARRIOR,
    name: 'Keyboard Warrior',
    emoji: '👾',
    type: 'discord',
    threshold: 200, // 200+ messages
    points: 50,
    color: '#00ff88'
  },
  KEYBOARD_OVERLORD: {
    id: process.env.ROLE_KEYBOARD_OVERLORD,
    name: 'Keyboard Overlord',
    emoji: '🏆',
    type: 'discord',
    threshold: 500, // 500+ messages
    points: 100,
    color: '#ffff00'
  },
  ARCADE_OG: {
    id: process.env.ROLE_ARCADE_OG,
    name: 'Arcade OG',
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
  WARMING_UP: {
    id: process.env.ROLE_WARMING_UP,
    name: 'Warming Up',
    emoji: '🔥',
    type: 'game',
    threshold: 25, // 25+ games
    points: 25,
    color: '#ff00ff'
  },
  GRIND_MODE: {
    id: process.env.ROLE_GRIND_MODE,
    name: 'Grind Mode',
    emoji: '💪',
    type: 'game',
    threshold: 100, // 100+ games
    points: 75,
    color: '#00ff88'
  },
  PIXEL_OVERLORD: {
    id: process.env.ROLE_PIXEL_OVERLORD,
    name: 'Pixel Overlord',
    emoji: '🎖️',
    type: 'game',
    threshold: 500, // 500+ games
    points: 150,
    color: '#ffff00'
  },
  DAILY_FINAL_BOSS: {
    id: process.env.ROLE_DAILY_FINAL_BOSS,
    name: 'Daily Final Boss',
    emoji: '🏅',
    type: 'game',
    threshold: 'leaderboard', // Hit daily top 10
    points: 50,
    color: '#ff6600'
  },
  TOURNAMENT_CHAMPION: {
    id: process.env.ROLE_TOURNAMENT_CHAMPION,
    name: 'Tournament Champion',
    emoji: '🥇',
    type: 'game',
    threshold: 'tournament', // Won a tournament
    points: 200,
    color: '#ffd700'
  },

  // Token Holder Roles
  EIGHT_BIT_HOLDER: {
    id: process.env.ROLE_8BIT_HOLDER,
    name: '8bit Holder',
    emoji: '💎',
    type: 'holder',
    threshold: 1, // Any 8BIT
    points: 50,
    color: '#9933ff'
  },
  BOSS_LEVEL_WHALE: {
    id: process.env.ROLE_BOSS_LEVEL_WHALE,
    name: 'Boss Level Whale',
    emoji: '🔥',
    type: 'holder',
    threshold: 1000000, // 1M+ 8BIT
    points: 100,
    color: '#ffd700'
  },

  // Epic Roles
  LEVEL_99: {
    id: process.env.ROLE_LEVEL_99,
    name: 'Level 99',
    emoji: '🌟',
    type: 'epic',
    threshold: 'all', // Maxed all milestones
    points: 300,
    color: '#ff9900'
  }
};

// Discord message thresholds for role progression
const MESSAGE_THRESHOLDS = [
  { count: 0, role: 'NOOB' },
  { count: 50, role: 'PLAYER_1' },
  { count: 200, role: 'KEYBOARD_WARRIOR' },
  { count: 500, role: 'KEYBOARD_OVERLORD' }
];

// Game thresholds for role progression
const GAME_THRESHOLDS = [
  { count: 1, role: 'FIRST_BLOOD' },
  { count: 25, role: 'WARMING_UP' },
  { count: 100, role: 'GRIND_MODE' },
  { count: 500, role: 'PIXEL_OVERLORD' }
];

// Token holder thresholds
const HOLDER_THRESHOLDS = [
  { amount: 1, role: 'EIGHT_BIT_HOLDER' },
  { amount: 1000000, role: 'BOSS_LEVEL_WHALE' }
];

// Roles required for Level 99 (must have ALL of these)
const LEVEL_99_REQUIREMENTS = [
  'KEYBOARD_OVERLORD',  // 500+ messages
  'PIXEL_OVERLORD',     // 500+ games
  'EIGHT_BIT_HOLDER'    // Hold 8BIT
];

module.exports = {
  ROLES,
  MESSAGE_THRESHOLDS,
  GAME_THRESHOLDS,
  HOLDER_THRESHOLDS,
  LEVEL_99_REQUIREMENTS,
  DISCORD_TOKEN: process.env.DISCORD_BOT_TOKEN,
  CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  GUILD_ID: process.env.DISCORD_GUILD_ID,
  OG_CUTOFF_DATE: new Date(process.env.OG_CUTOFF_DATE || '2026-02-25T23:59:59Z')
};

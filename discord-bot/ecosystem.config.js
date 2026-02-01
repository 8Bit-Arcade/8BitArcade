module.exports = {
  apps: [{
    name: '8bit-arcade-bot',
    script: 'src/index.js',
    cwd: '/home/user/8BitArcade/discord-bot',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    env: {
      NODE_ENV: 'production'
    }
  }]
};

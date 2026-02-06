module.exports = {
  apps: [{
    name: '8bit-telegram-bot',
    script: './dist/index.js',
    cwd: __dirname,
    watch: false,
    autorestart: true,
    max_restarts: 10,
    env: {
      NODE_ENV: 'production'
    }
  }]
};

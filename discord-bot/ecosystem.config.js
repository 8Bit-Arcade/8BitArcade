module.exports = {
  apps: [{
    name: '8bit-arcade-bot',
    script: './src/index.js',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    env: {
      NODE_ENV: 'production'
    }
  }]
};

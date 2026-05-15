module.exports = {
  apps: [{
    name:   'edularp',
    script: 'node_modules/.bin/next',
    args:   'start',
    cwd:    '/var/www/edularp-app',
    env: {
      NODE_ENV: 'production',
      PORT:     '3000',
    },
    max_memory_restart: '512M',
    error_file:    './logs/err.log',
    out_file:      './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    restart_delay: 3000,
    watch:  false,
  }],
}

module.exports = {
  apps: [{
    name:   'edularp',
    script: 'node',
    args:   '.next/standalone/server.js',
    cwd:    '/var/www/edularp-app',
    env: {
      NODE_ENV: 'production',
      PORT:     '3000',
      HOSTNAME: '0.0.0.0',
    },
    max_memory_restart: '512M',
    error_file:    './logs/err.log',
    out_file:      './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    restart_delay: 3000,
    watch:  false,
  }],
}

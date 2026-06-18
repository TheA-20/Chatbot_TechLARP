const path = require('path')
const fs   = require('fs')

// Read a single key from a .env file so critical secrets are in process.env
// before any Node module loads — fixes a timing issue where lib/db.ts reads
// DATABASE_URL at import time, before Next.js's own loadEnvConfig has run.
function readEnvKey(file, key) {
  try {
    const line = fs.readFileSync(file, 'utf8')
      .split('\n')
      .find(l => l.startsWith(key + '='))
    if (!line) return ''
    return line.slice(key.length + 1).replace(/^["']|["']$/g, '').trim()
  } catch { return '' }
}

const envFile = path.join(__dirname, '.env.local')

module.exports = {
  apps: [{
    name:   'edularp',
    script: 'node',
    args:   '.next/standalone/server.js',
    cwd:    '/var/www/edularp-app',
    env: {
      NODE_ENV:     'production',
      PORT:         '3000',
      HOSTNAME:     '0.0.0.0',
      DATABASE_URL: readEnvKey(envFile, 'DATABASE_URL'),
    },
    max_memory_restart: '512M',
    error_file:    './logs/err.log',
    out_file:      './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    restart_delay: 3000,
    watch:  false,
  }],
}

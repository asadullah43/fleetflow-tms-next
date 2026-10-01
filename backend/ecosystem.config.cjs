/**
 * PM2 process file, for running the built backend without Docker:
 *
 *   npm run build && pm2 start ecosystem.config.cjs
 *
 * One instance only: the rate limiter keeps its counters in this
 * process's memory (see utils/rate-limiter.ts), so running several
 * instances would multiply every limit by the instance count.
 * Secrets (DATABASE_URL, JWT_SECRET) come from the environment / .env —
 * never put them in this file.
 */
module.exports = {
  apps: [
    {
      name: 'fleetflow-api',
      script: 'dist/app.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      env: { NODE_ENV: 'production' },
    },
  ],
};

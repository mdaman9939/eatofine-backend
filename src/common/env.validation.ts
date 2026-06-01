/**
 * Env validation. Called once from main.ts before the Nest factory creates
 * the AppModule.
 *
 * Two failure modes:
 *   • HARD-FAIL (throw)  — Mongo creds are missing. The app literally can't
 *                          function without these.
 *   • SOFT-WARN (stderr) — JWT looks weak, CORS missing, CORS uses wildcard.
 *                          App still boots; the warning makes it visible.
 *
 * Set STRICT_ENV_CHECK=1 to upgrade soft warnings to hard failures (CI).
 */

type EnvIssue = { var: string; reason: string };

const ALWAYS_REQUIRED = [
  'MONGO_USER',
  'MONGO_PASSWORD',
  'MONGO_HOSTS',
] as const;

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const strict = process.env.STRICT_ENV_CHECK === '1';

  const errors: EnvIssue[] = [];
  const warnings: EnvIssue[] = [];

  // Mongo connection cannot be guessed — always required.
  for (const key of ALWAYS_REQUIRED) {
    if (!process.env[key]?.trim()) {
      errors.push({ var: key, reason: 'missing or empty (cannot connect to DB without this)' });
    }
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    (isProd ? warnings : warnings).push({
      var: 'JWT_SECRET',
      reason: 'missing — auth module will use a dev fallback. NOT SAFE for production',
    });
  } else if (jwtSecret.length < 16) {
    warnings.push({ var: 'JWT_SECRET', reason: `weak (only ${jwtSecret.length} chars, recommend ≥32)` });
  } else if (isProd && /change[-_ ]?me|dev[-_ ]?secret|todo|placeholder/i.test(jwtSecret)) {
    warnings.push({ var: 'JWT_SECRET', reason: 'looks like a placeholder — generate one with `openssl rand -hex 32`' });
  }

  const port = process.env.PORT ?? process.env.NODE_PORT;
  if (port && !/^\d+$/.test(port)) {
    errors.push({ var: 'PORT/NODE_PORT', reason: `must be an integer, got "${port}"` });
  }

  if (isProd) {
    const cors = process.env.CORS_ORIGINS?.trim();
    if (!cors) {
      warnings.push({ var: 'CORS_ORIGINS', reason: 'not set in production — CORS will allow all origins' });
    } else if (/\*/.test(cors)) {
      warnings.push({ var: 'CORS_ORIGINS', reason: 'contains a wildcard — recommend explicit origin list' });
    }
  }

  // Print warnings — visible in Render logs so misconfigurations don't go silently.
  if (warnings.length > 0) {
    const lines = warnings.map((w) => `  • ${w.var}: ${w.reason}`).join('\n');
    // eslint-disable-next-line no-console
    console.warn(`\n⚠️  Env warnings (${isProd ? 'PRODUCTION' : 'DEVELOPMENT'} mode):\n${lines}\n`);
  }

  // In strict mode, warnings escalate to errors.
  if (strict) errors.push(...warnings);

  if (errors.length > 0) {
    const lines = errors.map((e) => `  • ${e.var}: ${e.reason}`).join('\n');
    throw new Error(
      `\n\n❌ Environment validation failed.\nRefusing to boot until these are fixed:\n${lines}\n\n` +
      `See .env.example for the canonical list. Generate a JWT secret with:\n` +
      `  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n`,
    );
  }
}

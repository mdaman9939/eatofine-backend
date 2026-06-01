/**
 * Fail-fast env validation. Called once from main.ts before the Nest factory
 * creates the AppModule — anything missing or malformed throws here, so we
 * never boot a half-configured server into production.
 *
 * Why hand-rolled instead of Zod/Joi: zero new deps, and the rules are
 * static enough that a few `if` blocks are clearer than a schema. If env
 * shape grows beyond ~20 fields we should switch to Zod.
 */

type EnvIssue = { var: string; reason: string };

const PROD_REQUIRED = [
  'MONGO_USER',
  'MONGO_PASSWORD',
  'MONGO_HOSTS',
  'JWT_SECRET',
  'CORS_ORIGINS',
] as const;

const DEV_REQUIRED = [
  'MONGO_USER',
  'MONGO_PASSWORD',
  'MONGO_HOSTS',
] as const;

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const required = isProd ? PROD_REQUIRED : DEV_REQUIRED;
  const issues: EnvIssue[] = [];

  for (const key of required) {
    const value = process.env[key]?.trim();
    if (!value) issues.push({ var: key, reason: 'missing or empty' });
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (jwtSecret && jwtSecret.length < 16) {
    issues.push({ var: 'JWT_SECRET', reason: `too short (got ${jwtSecret.length} chars, need ≥16)` });
  }
  if (isProd && jwtSecret && /change[-_ ]?me|dev[-_ ]?secret|todo|placeholder/i.test(jwtSecret)) {
    issues.push({ var: 'JWT_SECRET', reason: 'looks like a placeholder — generate one with `openssl rand -hex 32`' });
  }

  const port = process.env.PORT ?? process.env.NODE_PORT;
  if (port && !/^\d+$/.test(port)) {
    issues.push({ var: 'PORT/NODE_PORT', reason: `must be an integer, got "${port}"` });
  }

  if (isProd) {
    const cors = process.env.CORS_ORIGINS?.trim();
    if (cors && /\*/.test(cors)) {
      issues.push({ var: 'CORS_ORIGINS', reason: 'wildcards not allowed in production — list explicit origins' });
    }
  }

  if (issues.length > 0) {
    const lines = issues.map((i) => `  • ${i.var}: ${i.reason}`).join('\n');
    const mode = isProd ? 'PRODUCTION' : 'DEVELOPMENT';
    throw new Error(
      `\n\n❌ Environment validation failed (${mode} mode).\n` +
      `Refusing to boot until these are fixed:\n${lines}\n\n` +
      `See .env.example for the canonical list. Generate a JWT secret with:\n` +
      `  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n`,
    );
  }
}
